// vacancy-manager.js — модуль для управления вакансиями

(function() {
  'use strict';

  const CFG = window.APP_CONFIG || {};
  const CONST = window.APP_CONSTANTS || {};
  const UTIL = window.utils || {};

  // Haptic Feedback для Telegram WebApp (требует Bot API 6.1+)
  function triggerHaptic(type, style) {
    try {
      const webApp = window.Telegram?.WebApp;
      if (!webApp?.HapticFeedback) return;
      
      // Проверяем версию (HapticFeedback доступен с версии 6.1+)
      const version = parseFloat(webApp.version || '6.0');
      if (version < 6.1) return;
      
      switch (type) {
        case 'impact':
          webApp.HapticFeedback.impactOccurred(style || 'light');
          break;
        case 'notification':
          webApp.HapticFeedback.notificationOccurred(style || 'success');
          break;
        case 'selection':
          webApp.HapticFeedback.selectionChanged();
          break;
      }
    } catch (e) {
      // Тихо игнорируем ошибки - не все версии поддерживают
    }
  }

  class VacancyManager {
    constructor() {
      this.updateStatusLocks = new Set();
    }

    // Загрузить вакансии для категории
    async fetchVacanciesForCategory(key, options = {}) {
      const {
        isInitialLoad = false,
        isPullToRefresh = false,
        signal
      } = options;

      // Проверяем состояние
      const stateManager = window.stateManager;
      const domManager = window.domManager;
      
      if (!stateManager || !domManager) {
        throw new Error('Менеджеры не инициализированы');
      }

      if (stateManager.isCategoryBusy(key)) {
        logger.log(`Категория ${key} уже загружается`);
        return;
      }

      // Проверяем rate limit только для дополнительных загрузок
      const categoryState = stateManager.getCategoryState(key);
      if (!isInitialLoad && !isPullToRefresh && categoryState.offset > 0) {
        const rateResult = await UTIL.checkRateLimit?.('loadVacancies');
        if (rateResult && !rateResult.allowed) {
          UTIL.uiToast?.(rateResult.message);
          return;
        }
      }

      stateManager.setCategoryBusy(key, true);

      try {
        // Показываем полноэкранный прелоадер только при самой первой загрузке приложения
        if (isInitialLoad && categoryState.offset === 0) {
          domManager.showLoader();
        }
        
        // Показываем skeleton при переключении вкладок (первая загрузка категории, но не приложения)
        if (categoryState.offset === 0 && !isInitialLoad) {
          // Skeleton показывается автоматически через DOM manager при переключении вкладок
          // Здесь ничего дополнительного делать не нужно
        }

        // Загружаем данные через API
        const apiService = window.apiService;
        if (!apiService) {
          throw new Error('API сервис не инициализирован');
        }

        const limit = CONST?.PAGE_SIZES?.MAIN || CFG.PAGE_SIZE_MAIN || 10;
        const query = stateManager.getState().query;
        
        const result = await apiService.fetchVacancies(
          key, 
          limit, 
          categoryState.offset, 
          query, 
          signal
        );

        if (!result.success) {
          if (result.aborted) {
            this.handleFetchAbort(key, categoryState.offset);
            return;
          }
          
          // Обработка специфичных ошибок
          if (result.severity === 'warning' && result.isRetryable) {
            // Для retryable ошибок показываем кнопку повтора
            this.handleRetryableError(key, () => {
              this.fetchVacanciesForCategory(key, isInitialLoad, isPullToRefresh);
            }, result.error);
            return;
          }
          
          throw new Error(result.error || 'Ошибка загрузки данных');
        }

        // Обрабатываем результат
        await this.processVacanciesResult(key, result, isInitialLoad, isPullToRefresh);

      } catch (error) {
        triggerHaptic('notification', 'error');
        this.handleFetchError(key, error, categoryState.offset);
      } finally {
        stateManager.setCategoryBusy(key, false);
        // Скрываем прелоадер только если он был показан (при isInitialLoad)
        if (isInitialLoad && categoryState.offset === 0) {
          domManager.hideLoader();
        }
        document.dispatchEvent(new CustomEvent('feed:loaded'));
      }
    }

    // Обработать результат загрузки вакансий
    async processVacanciesResult(key, result, isInitialLoad, isPullToRefresh = false) {
      const { data: items, total } = result;
      const stateManager = window.stateManager;
      const domManager = window.domManager;
      const state = stateManager.getCategoryState(key);

      // Валидация данных
      if (!Array.isArray(items)) {
        throw new Error('API вернул некорректный формат данных');
      }

      const validItems = items.filter(item => item && typeof item === 'object' && item.id);

      // Обновляем счетчик всегда когда получаем данные от API
      if (Number.isFinite(total)) {
        stateManager.updateCategoryState(key, { total });
        domManager.updateCounter(key, total);
      }

      // Очищаем контейнер при начальной загрузке
      if (state.offset === 0) {
        domManager.clearContainer(key);
      }

      const container = domManager.getElement(`containers.${key}`);
      if (!container) {
        throw new Error(`Контейнер для ${key} не найден`);
      }

      if (validItems.length === 0) {
        if (state.offset === 0) {
          const query = stateManager.getState().query;
          const message = query ? 'По вашему запросу ничего не найдено' : '-- Пусто в этой категории --';
          UTIL.renderEmptyState?.(container, message);
        }
      } else {
        // Создаем карточки вакансий
        const fragment = document.createDocumentFragment();
        const query = stateManager.getState().query;
        
        for (const item of validItems) {
          const card = UTIL.createVacancyCard?.(item, { 
            pageType: 'main', 
            searchQuery: query 
          });
          if (card) {
            fragment.appendChild(card);
          }
        }

        container.appendChild(fragment);
        domManager.pinLoadMoreToBottom(key);

        // Настраиваем кнопку "Загрузить еще"
        const { btn } = UTIL.ensureLoadMore?.(container, () => {
          this.fetchVacanciesForCategory(key);
        }) || {};

        const newOffset = state.offset + validItems.length;
        const hasMore = newOffset < total;
        
        stateManager.updateCategoryState(key, { offset: newOffset });
        UTIL.updateLoadMore?.(container, hasMore);
        
        if (btn) {
          btn.disabled = !hasMore;
        }
      }

      // Обновляем состояние загрузки
      const currentQuery = stateManager.getState().query;
      stateManager.updateCategoryState(key, {
        loadedOnce: true,
        loadedForQuery: currentQuery
      });

      this.updateSearchStats();
    }

    // Обработать отмену загрузки
    handleFetchAbort(key, offset) {
      if (offset === 0) {
        const container = window.domManager?.getElement(`containers.${key}`);
        const message = 'Превышено время ожидания. Проверьте соединение.';
        UTIL.renderError?.(container, message, () => {
          this.refetchFromZero(key);
        });
      }
    }

    // Обработать ошибку загрузки
    handleFetchError(key, error, offset) {
      console.error(`Ошибка загрузки вакансий для ${key}:`, error);
      
      if (offset === 0) {
        const container = window.domManager?.getElement(`containers.${key}`);
        let errorMessage = error.message;
        
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          errorMessage = 'Ошибка сети. Проверьте соединение.';
        }

        UTIL.renderError?.(container, errorMessage, () => {
          this.refetchFromZero(key);
        });
      }
    }

    // Перезагрузить категорию с начала
    async refetchFromZero(key, isPullToRefresh = false) {
      const stateManager = window.stateManager;
      if (!stateManager || stateManager.isCategoryBusy(key)) {
        return;
      }

      stateManager.updateCategoryState(key, { offset: 0 });
      await this.fetchVacanciesForCategory(key, { isPullToRefresh });
    }

    // Обновить статус вакансии
    async updateVacancyStatus(vacancyId, newStatus, isFromSwipe = false) {
      logger.log('🔄 updateVacancyStatus вызван:', { vacancyId, newStatus, isFromSwipe });
      
      if (!vacancyId) {
        console.warn('ID вакансии не указан');
        return;
      }

      // Предотвращаем race conditions
      if (this.updateStatusLocks.has(vacancyId)) {
        logger.log('updateStatus уже выполняется для ID:', vacancyId);
        return;
      }

      // Проверяем rate limit
      const operation = newStatus === CFG.STATUSES?.FAVORITE ? 'favorite' : 'updateStatus';
      const rateResult = await UTIL.checkRateLimit?.(operation);
      if (rateResult && !rateResult.allowed) {
        UTIL.uiToast?.(rateResult.message);
        return;
      }

      this.updateStatusLocks.add(vacancyId);

      try {
        const isFavorite = newStatus === CFG.STATUSES?.FAVORITE;
        
        // Если это свайп, используем специальную логику с возможностью отмены
        if (isFromSwipe) {
          logger.log('🔄 Это свайп, используем performSwipeStatusUpdate');
          await this.performSwipeStatusUpdate(vacancyId, newStatus, isFavorite);
        } else {
          logger.log('🔄 Это кнопка, используем performStatusUpdate');
          // Сразу выполняем действие без подтверждения для кнопок
          await this.performStatusUpdate(vacancyId, newStatus, isFavorite);
        }

      } catch (error) {
        console.error('Ошибка в updateVacancyStatus:', error);
        triggerHaptic('notification', 'error');
        UTIL.safeAlert?.('Произошла ошибка при обновлении статуса');
      } finally {
        this.updateStatusLocks.delete(vacancyId);
      }
    }

    // Выполнить обновление статуса для свайпов с возможностью отмены
    async performSwipeStatusUpdate(vacancyId, newStatus, isFavorite) {
      logger.log('🔄 performSwipeStatusUpdate вызван:', { vacancyId, newStatus, isFavorite });
      
      const cardElement = document.querySelector(`#card-${CSS.escape(vacancyId)}`);
      if (!cardElement) {
        console.warn('Карточка вакансии не найдена:', vacancyId);
        return;
      }

      const parent = cardElement.parentElement;
      const nextSibling = cardElement.nextElementSibling;

      // Анимация скрытия для свайпа
      this.animateCardHidingForSwipe(cardElement);
      logger.log('✅ Анимация скрытия применена для свайпа');

      // Функция отмены с transition-анимацией въезда (как в избранном)
      const onUndo = () => {
        logger.log('🔄 Отмена свайпа для вакансии:', vacancyId);
        
        // Возвращаем карточку на место
        parent.insertBefore(cardElement, nextSibling);
        
        requestAnimationFrame(() => {
          // Убираем все свайп-классы чтобы карточка не была залитой
          cardElement.classList.remove('swipe-left', 'swipe-right');
          
          // Принудительно убираем любые overlays
          const overlays = cardElement.querySelectorAll('.swipe-action-overlay');
          overlays.forEach(overlay => {
            overlay.classList.remove('visible');
            overlay.style.opacity = '0';
          });
          
          // Анимация возврата карточки для свайпов (как в избранном)
          cardElement.style.transition = 'opacity .3s, transform .3s, max-height .3s, margin .3s, padding .3s, border-width .3s';
          cardElement.style.opacity = '1';
          cardElement.style.transform = 'translate3d(0, 0, 0)'; // Возврат на место (как в избранном для свайпов)
          cardElement.style.maxHeight = '500px';
          cardElement.style.paddingTop = '';
          cardElement.style.paddingBottom = '';
          cardElement.style.marginTop = '';
          cardElement.style.marginBottom = '';
          cardElement.style.borderWidth = '';
          
          // Сбрасываем также стили background если они остались
          cardElement.style.background = '';
          cardElement.style.backgroundColor = '';
          cardElement.style.removeProperty('background');
          cardElement.style.removeProperty('background-color');
          
          // Убираем transition после анимации
          setTimeout(() => {
            cardElement.style.transition = '';
            logger.log('✅ Анимация возврата завершена для вакансии:', vacancyId);
          }, 300);
        });
      };

      // Показываем toast с возможностью отмены для свайпов
      const toastMessage = isFavorite ? 'Добавлено в избранное' : 'Вакансия удалена';
      
      // Haptic feedback для успешного действия
      if (isFavorite) {
        triggerHaptic('notification', 'success');
      } else {
        triggerHaptic('impact', 'medium');
      }
      
      logger.log('📱 Показываем toast с возможностью отмены для свайпа');
      UTIL.uiToast?.(toastMessage, {
        timeout: 5000,
        onUndo,
        onTimeout: async () => {
          logger.log('⏰ Таймаут toast для свайпа, финализируем удаление:', vacancyId);
          await this.finalizeStatusUpdate(vacancyId, newStatus, cardElement, parent);
        }
      });
    }

    // Выполнить обновление статуса для кнопок
    async performStatusUpdate(vacancyId, newStatus, isFavorite) {
      const cardElement = document.querySelector(`#card-${CSS.escape(vacancyId)}`);
      if (!cardElement) {
        console.warn('Карточка вакансии не найдена:', vacancyId);
        return;
      }

      // Анимация скрытия
      this.animateCardHiding(cardElement);

      const parent = cardElement.parentElement;
      const nextSibling = cardElement.nextElementSibling;

      // Функция отмены с transition-анимацией въезда (как в избранном)
      const onUndo = () => {
        parent.insertBefore(cardElement, nextSibling);
        requestAnimationFrame(() => {
          // Убираем все свайп-классы чтобы карточка не была залитой
          cardElement.classList.remove('swipe-left', 'swipe-right');
          
          // Принудительно убираем любые overlays
          const overlays = cardElement.querySelectorAll('.swipe-action-overlay');
          overlays.forEach(overlay => {
            overlay.classList.remove('visible');
            overlay.style.opacity = '0';
          });
          
          cardElement.style.transition = 'opacity .3s, transform .3s, max-height .3s, margin .3s, padding .3s, border-width .3s';
          cardElement.style.opacity = '1';
          cardElement.style.transform = 'scale(1)';
          cardElement.style.maxHeight = '500px';
          cardElement.style.paddingTop = '';
          cardElement.style.paddingBottom = '';
          cardElement.style.marginTop = '';
          cardElement.style.marginBottom = '';
          cardElement.style.borderWidth = '';
          
          // Сбрасываем также стили background если они остались
          cardElement.style.background = '';
          cardElement.style.backgroundColor = '';
          cardElement.style.removeProperty('background');
          cardElement.style.removeProperty('background-color');
          
          // Убираем transition после анимации
          setTimeout(() => {
            cardElement.style.transition = '';
          }, 300);
        });
      };

      // Показываем toast с возможностью отмены
      const toastMessage = isFavorite ? 'Добавлено в избранное' : 'Вакансия удалена';
      
      // Haptic feedback для успешного действия
      if (isFavorite) {
        triggerHaptic('notification', 'success');
      } else {
        triggerHaptic('impact', 'medium');
      }
      
      UTIL.uiToast?.(toastMessage, {
        timeout: 5000,
        onUndo,
        onTimeout: async () => {
          await this.finalizeStatusUpdate(vacancyId, newStatus, cardElement, parent);
        }
      });
    }

    // Анимация скрытия карточки для кнопок (как в избранном)
    animateCardHiding(cardElement) {
      // БЕЗ transform - только плавное исчезновение (как в избранном для кнопок)
      cardElement.style.transition = 'opacity .3s, max-height .3s, margin .3s, padding .3s, border-width .3s';
      cardElement.style.opacity = '0';
      cardElement.style.maxHeight = '0px';
      cardElement.style.paddingTop = '0';
      cardElement.style.paddingBottom = '0';
      cardElement.style.marginTop = '0';
      cardElement.style.marginBottom = '0';
      cardElement.style.borderWidth = '0';
    }

    // Анимация скрытия карточки для свайпов (как в избранном для свайпов)
    animateCardHidingForSwipe(cardElement) {
      // НЕ перезаписываем transform - он уже установлен в swipe-handler
      // Добавляем только opacity и maxHeight для плавного исчезновения
      cardElement.style.transition = 'opacity .3s, max-height .3s, margin .3s, padding .3s, border-width .3s';
      cardElement.style.opacity = '0';
      cardElement.style.maxHeight = '0px';
      cardElement.style.paddingTop = '0';
      cardElement.style.paddingBottom = '0';
      cardElement.style.marginTop = '0';
      cardElement.style.marginBottom = '0';
      cardElement.style.borderWidth = '0';
    }

    // Анимация показа карточки с transition
    animateCardShowing(cardElement) {
      // Убираем все свайп-классы чтобы карточка не была залитой
      cardElement.classList.remove('swipe-left', 'swipe-right');
      
      // Принудительно убираем любые overlays
      const overlays = cardElement.querySelectorAll('.swipe-action-overlay');
      overlays.forEach(overlay => {
        overlay.classList.remove('visible');
        overlay.style.opacity = '0';
      });
      
      cardElement.style.transition = 'opacity .3s, transform .3s, max-height .3s, margin .3s, padding .3s, border-width .3s';
      cardElement.style.opacity = '1';
      cardElement.style.transform = 'scale(1)';
      cardElement.style.maxHeight = '500px';
      cardElement.style.paddingTop = '';
      cardElement.style.paddingBottom = '';
      cardElement.style.marginTop = '';
      cardElement.style.marginBottom = '';
      cardElement.style.borderWidth = '';
      
      // Сбрасываем также стили background если они остались
      cardElement.style.background = '';
      cardElement.style.backgroundColor = '';
      cardElement.style.removeProperty('background');
      cardElement.style.removeProperty('background-color');
      
      // Убираем transition после анимации
      setTimeout(() => {
        cardElement.style.transition = '';
      }, 300);
    }

    // Финализировать обновление статуса
    async finalizeStatusUpdate(vacancyId, newStatus, cardElement, parentContainer) {
      try {
        // Удаляем карточку из DOM
        cardElement.remove();

        // Обновляем статус в API
        const apiService = window.apiService;
        const result = await apiService?.updateVacancyStatus(vacancyId, newStatus);
        
        if (!result?.success) {
          throw new Error(result?.error || 'Ошибка обновления статуса');
        }

        // Обновляем счетчики
        const stateManager = window.stateManager;
        const activeKey = stateManager?.getState().activeKey;
        if (activeKey) {
          const categoryState = stateManager.getCategoryState(activeKey);
          if (categoryState.total > 0) {
            const newTotal = categoryState.total - 1;
            stateManager.updateCategoryState(activeKey, { total: newTotal });
            window.domManager?.updateCounter(activeKey, newTotal);
          }
        }

        // Показываем пустое состояние, если больше нет вакансий
        if (parentContainer && parentContainer.querySelectorAll('.vacancy-card').length === 0) {
          UTIL.renderEmptyState?.(parentContainer, '-- Пусто в этой категории --');
        }

      } catch (error) {
        console.error('Ошибка финализации обновления статуса:', error);
        UTIL.safeAlert?.('Не удалось выполнить действие.');
        
        // Восстанавливаем карточку при ошибке
        parentContainer.insertBefore(cardElement, parentContainer.firstChild);
        this.animateCardShowing(cardElement);
      }
    }

    // Обновить поисковую статистику
    updateSearchStats() {
      const stateManager = window.stateManager;
      const domManager = window.domManager;
      
      if (!stateManager || !domManager) return;

      const state = stateManager.getState();
      const activeContainer = domManager.getElement(`containers.${state.activeKey}`);
      
      if (!activeContainer) return;

      const visible = activeContainer.querySelectorAll('.vacancy-card').length;
      const categoryState = stateManager.getCategoryState(state.activeKey);
      const total = categoryState.total || visible;

      domManager.updateSearchStats(visible, total, state.query);
    }

    // Массовое удаление вакансий в категории
    async bulkDeleteCategory(key) {
      const confirmed = await UTIL.showCustomConfirm?.('Удалить ВСЕ вакансии в этой категории?');
      if (!confirmed) return;

      try {
        // Формируем параметры для bulk операции
        const params = new URLSearchParams();
        params.set('status', `eq.${CFG.STATUSES?.NEW}`);
        
        if (key === 'main') {
          params.set('category', `eq.${CFG.CATEGORIES?.MAIN}`);
        } else if (key === 'maybe') {
          params.set('category', `eq.${CFG.CATEGORIES?.MAYBE}`);
        } else {
          params.set('category', `not.in.("${CFG.CATEGORIES?.MAIN}","${CFG.CATEGORIES?.MAYBE}")`);
        }

        const url = `${CFG.SUPABASE_URL}/rest/v1/vacancies?${params.toString()}`;
        const headers = UTIL.createSupabaseHeaders?.({ prefer: 'return=minimal' });
        
        const response = await UTIL.fetchWithRetry?.(url, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: CFG.STATUSES?.DELETED }),
        }, CFG.RETRY_OPTIONS);

        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }

        // Очищаем UI
        window.domManager?.clearContainer(key);
        window.domManager?.hideLoadMore(key);
        window.domManager?.updateCounter(key, 0);

        // Обновляем состояние
        window.stateManager?.updateCategoryState(key, {
          offset: 0,
          total: 0,
          loadedOnce: true,
          loadedForQuery: window.stateManager.getState().query
        });

        // Показываем пустое состояние
        const container = window.domManager?.getElement(`containers.${key}`);
        UTIL.renderEmptyState?.(container, '-- Пусто в этой категории --');
        
        UTIL.uiToast?.('Категория очищена');

      } catch (error) {
        console.error('Ошибка массового удаления:', error);
        UTIL.safeAlert?.('Не удалось удалить вакансии из этой категории. Попробуйте позже.');
      }
    }

    // Обработать retryable ошибку
    handleRetryableError(key, retryCallback, errorMessage) {
      const domManager = window.domManager;
      const container = domManager.getElement(`containers.${key}`);
      
      if (!container) return;

      // Показываем ошибку с кнопкой повтора
      UTIL.renderError?.(container, errorMessage, retryCallback);
      
      // Добавляем в очередь повтора сетевого менеджера
      if (window.networkManager) {
        window.networkManager.addToRetryQueue({
          callback: retryCallback,
          category: key,
          type: 'fetch_vacancies'
        });
      }
    }

    // Получить статистику менеджера
    getStats() {
      return {
        activeLocks: this.updateStatusLocks.size,
        lockedVacancies: Array.from(this.updateStatusLocks)
      };
    }
  }

  // Создаем глобальный экземпляр менеджера вакансий
  window.vacancyManager = new VacancyManager();

})();