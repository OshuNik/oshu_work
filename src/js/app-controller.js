// app-controller.js — главный контроллер приложения

(function() {
  'use strict';

  const CFG = window.APP_CONFIG || {};
  const CONST = window.APP_CONSTANTS || {};
  const UTIL = window.utils || {};

  class AppController {
    constructor() {
      this.initialized = false;
      this.initPromise = null;
      this.eventListeners = new Map();
      this.abortController = new AbortController();
    }

    // Проверить готовность всех зависимостей
    checkDependencies() {
      const dependencies = [
        'APP_CONFIG',
        'APP_CONSTANTS', 
        'utils',
        'stateManager',
        'domManager',
        'eventManager',
        'apiService',
        'vacancyManager'
      ];

      const missing = dependencies.filter(dep => !window[dep]);
      
      if (missing.length > 0) {
        throw new Error(`Отсутствуют зависимости: ${missing.join(', ')}`);
      }

      return true;
    }

    // Ждать готовности DOM
    async waitForDOM() {
      return new Promise((resolve) => {
        if (document.readyState === 'loading') {
          const domLoadedHandler = () => {
            resolve();
          };
          document.addEventListener('DOMContentLoaded', domLoadedHandler, { 
            once: true,
            signal: this.abortController.signal 
          });
          this.eventListeners.set('DOMContentLoaded', { 
            element: document, 
            event: 'DOMContentLoaded', 
            handler: domLoadedHandler 
          });
        } else {
          resolve();
        }
      });
    }

    // Настроить обработчики событий приложения
    setupAppEventHandlers() {
      const signal = this.abortController.signal;
      
      // Обработчик поиска
      const searchHandler = async (e) => {
        const { query } = e.detail;
        await this.handleSearch(query);
      };
      document.addEventListener('search:triggered', searchHandler, { signal });
      this.eventListeners.set('search:triggered', { 
        element: document, 
        event: 'search:triggered', 
        handler: searchHandler 
      });

      // Обработчик активации вкладки
      const tabActivatedHandler = async (e) => {
        const { targetId } = e.detail;
        await this.handleTabActivation(targetId);
      };
      document.addEventListener('tab:activated', tabActivatedHandler, { signal });
      this.eventListeners.set('tab:activated', { 
        element: document, 
        event: 'tab:activated', 
        handler: tabActivatedHandler 
      });

      // Обработчик длинного нажатия на вкладку
      const tabLongPressHandler = async (e) => {
        const { key } = e.detail;
        await this.handleTabLongPress(key);
      };
      document.addEventListener('tab:longPress', tabLongPressHandler, { signal });
      this.eventListeners.set('tab:longPress', { 
        element: document, 
        event: 'tab:longPress', 
        handler: tabLongPressHandler 
      });

      // Обработчик действий с вакансиями
      const vacancyActionHandler = async (e) => {
        const { action, vacancyId, url } = e.detail;
        await this.handleVacancyAction(action, vacancyId, url);
      };
      document.addEventListener('vacancy:action', vacancyActionHandler, { signal });
      this.eventListeners.set('vacancy:action', { 
        element: document, 
        event: 'vacancy:action', 
        handler: vacancyActionHandler 
      });

      // Обработчик загрузки дополнительных вакансий
      const loadMoreHandler = async (e) => {
        const { key } = e.detail;
        await this.handleLoadMore(key);
      };
      document.addEventListener('loadMore:triggered', loadMoreHandler, { signal });
      this.eventListeners.set('loadMore:triggered', { 
        element: document, 
        event: 'loadMore:triggered', 
        handler: loadMoreHandler 
      });

      // Обработчик появления страницы
      const pageVisibleHandler = () => {
        this.handlePageVisible();
      };
      document.addEventListener('page:visible', pageVisibleHandler, { signal });
      this.eventListeners.set('page:visible', { 
        element: document, 
        event: 'page:visible', 
        handler: pageVisibleHandler 
      });
    }

    // Обработать поиск
    async handleSearch(query) {
      try {
        // Загружаем счетчики для нового запроса
        const countsResult = await window.apiService.fetchCountsAll(query);
        if (countsResult.success) {
          window.stateManager.updateCounts(countsResult.counts);
          
          // Обновляем счетчики в UI
          Object.keys(countsResult.counts).forEach(key => {
            window.domManager.updateCounter(key, countsResult.counts[key]);
          });
        }

        // Выполняем поиск в активной категории
        const activeKey = window.stateManager.getState().activeKey;
        await this.performSeamlessSearch(activeKey);

        // Сбрасываем состояние остальных категорий
        ['main', 'maybe', 'other'].forEach(key => {
          if (key !== activeKey) {
            window.stateManager.resetCategoryState(key);
            window.domManager.clearContainer(key);
            window.domManager.hideLoadMore(key);
          }
        });

      } catch (error) {
        console.error('Ошибка поиска:', error);
        UTIL.safeAlert?.('Произошла ошибка при поиске');
      }
    }

    // Выполнить плавный поиск
    async performSeamlessSearch(key) {
      const categoryState = window.stateManager.getCategoryState(key);
      
      if (categoryState.busy) {
        return;
      }

      // Проверяем rate limit
      const rateResult = await UTIL.checkRateLimit?.('search');
      if (rateResult && !rateResult.allowed) {
        UTIL.uiToast?.(rateResult.message);
        return;
      }

      window.stateManager.setCategoryBusy(key, true);
      window.stateManager.updateCategoryState(key, { offset: 0 });

      try {
        const query = window.stateManager.getState().query;
        const limit = CONST?.PAGE_SIZES?.MAIN || CFG.PAGE_SIZE_MAIN || 10;
        
        const result = await window.apiService.fetchVacancies(key, limit, 0, query);
        
        if (!result.success) {
          throw new Error(result.error || 'Ошибка поиска');
        }

        await this.processSearchResult(key, result);

      } catch (error) {
        console.error(`Ошибка поиска в категории ${key}:`, error);
        
        const container = window.domManager.getElement(`containers.${key}`);
        let errorMessage = error.message;
        
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          errorMessage = 'Ошибка сети при поиске. Проверьте соединение.';
        }

        UTIL.renderError?.(container, errorMessage, () => {
          this.performSeamlessSearch(key);
        });
      } finally {
        window.stateManager.setCategoryBusy(key, false);
      }
    }

    // Обработать результат поиска
    async processSearchResult(key, result) {
      const { data: items, total } = result;
      const query = window.stateManager.getState().query;
      
      // Обновляем счетчик
      if (Number.isFinite(total)) {
        window.domManager.updateCounter(key, total);
      }

      const container = window.domManager.getElement(`containers.${key}`);
      if (!container) return;

      const fragment = document.createDocumentFragment();
      
      if (items.length === 0) {
        const message = query ? 'По вашему запросу ничего не найдено' : '-- Пусто в этой категории --';
        const emptyElement = document.createElement('div');
        UTIL.renderEmptyState?.(emptyElement, message);
        if (emptyElement.firstElementChild) {
          fragment.appendChild(emptyElement.firstElementChild);
        }
      } else {
        items.forEach(item => {
          const card = UTIL.createVacancyCard?.(item, { 
            pageType: 'main', 
            searchQuery: query 
          });
          if (card) {
            fragment.appendChild(card);
          }
        });

        // Настраиваем кнопку "Загрузить еще"
        const newOffset = items.length;
        const hasMore = newOffset < total;
        
        window.stateManager.updateCategoryState(key, { offset: newOffset });
        
        if (hasMore) {
          const { wrap } = UTIL.ensureLoadMore?.(document.createElement('div'), () => {
            this.handleLoadMore(key);
          }) || {};
          
          if (wrap) {
            UTIL.updateLoadMore?.(wrap, hasMore);
            fragment.appendChild(wrap);
          }
        }
      }

      container.replaceChildren(fragment);

      // Обновляем состояние загрузки
      window.stateManager.updateCategoryState(key, {
        loadedOnce: true,
        loadedForQuery: query
      });

      window.vacancyManager.updateSearchStats();
    }

    // Обработать активацию вкладки
    async handleTabActivation(targetId) {
      const key = window.domManager.getKeyFromTargetId(targetId);
      
      // Обновляем состояние
      window.stateManager.setActiveCategory(key);
      
      // Обновляем UI
      window.domManager.activateTab(targetId);
      window.domManager.showOnlyActiveTab(targetId);
      window.vacancyManager.updateSearchStats();

      // Загружаем категорию, если она не была загружена
      if (!window.stateManager.isCategoryLoadedForQuery(key)) {
        await window.vacancyManager.fetchVacanciesForCategory(key);
      }
    }

    // Обработать длинное нажатие на вкладку
    async handleTabLongPress(key) {
      await window.vacancyManager.bulkDeleteCategory(key);
    }

    // Обработать действие с вакансией
    async handleVacancyAction(action, vacancyId, url) {
      switch (action) {
        case 'apply':
          if (url) {
            UTIL.openLink?.(url);
          }
          break;
          
        case 'favorite':
          await window.vacancyManager.updateVacancyStatus(vacancyId, CFG.STATUSES?.FAVORITE);
          break;
          
        case 'delete':
          await window.vacancyManager.updateVacancyStatus(vacancyId, CFG.STATUSES?.DELETED);
          break;
          
        default:
          console.warn('Неизвестное действие:', action);
      }
    }

    // Обработать загрузку дополнительных вакансий
    async handleLoadMore(key) {
      await window.vacancyManager.fetchVacanciesForCategory(key);
    }

    // Обработать появление страницы
    handlePageVisible() {
      try {
        if (localStorage.getItem('needs-refresh-main') === 'true') {
          localStorage.removeItem('needs-refresh-main');
          UTIL.uiToast?.('Обновление ленты...');
          
          const activeKey = window.stateManager.getState().activeKey;
          const query = window.stateManager.getState().query;
          
          // Обновляем счетчики
          window.apiService.fetchCountsAll(query).then(result => {
            if (result.success) {
              window.stateManager.updateCounts(result.counts);
              Object.keys(result.counts).forEach(key => {
                window.domManager.updateCounter(key, result.counts[key]);
              });
            }
          });
          
          // Перезагружаем активную категорию
          window.vacancyManager.refetchFromZero(activeKey);
        }
      } catch (error) {
        console.warn('localStorage недоступен:', error);
        // Fallback: обновляем без проверки флага
        const activeKey = window.stateManager.getState().activeKey;
        UTIL.uiToast?.('Обновление ленты...');
        window.vacancyManager.refetchFromZero(activeKey);
      }
    }

    // Инициализировать приложение
    async initialize() {
      if (this.initialized) {
        return this.initPromise;
      }

      if (this.initPromise) {
        return this.initPromise;
      }

      this.initPromise = this._performInitialization();
      return this.initPromise;
    }

    // Выполнить инициализацию
    async _performInitialization() {
      try {
        logger.log('🚀 Запуск инициализации приложения');

        // Показываем skeleton loaders для лучшего UX
        window.domManager?.showSkeleton('main', 4);
        window.domManager?.showSkeleton('maybe', 3);
        window.domManager?.showSkeleton('other', 2);

        // Устанавливаем таймаут для skeleton
        const skeletonTimeout = setTimeout(() => {
          console.warn('⚠️ Skeleton висит слишком долго, принудительно скрываем');
          window.domManager?.hideSkeleton('main');
          window.domManager?.hideSkeleton('maybe');
          window.domManager?.hideSkeleton('other');
        }, CONST?.TIMEOUTS?.LOADER || 25000);

        // Ждем готовности DOM
        await this.waitForDOM();

        // Проверяем зависимости
        this.checkDependencies();

        // Кэшируем DOM элементы
        window.domManager.cacheElements();

        // Проверяем критические элементы
        if (!window.domManager.validateCriticalElements()) {
          throw new Error('Критические элементы не найдены');
        }

        // Настраиваем начальное состояние UI
        this.setupInitialUI();

        // Настраиваем обработчики событий
        this.setupAppEventHandlers();
        window.eventManager.setupAllHandlers();

        // Настраиваем Pull-to-Refresh
        UTIL.setupPullToRefresh?.({
          onRefresh: (isPullToRefresh) => {
            const activeKey = window.stateManager.getState().activeKey;
            return window.vacancyManager.refetchFromZero(activeKey, isPullToRefresh);
          },
          refreshEventName: 'feed:loaded'
        });

        // Загружаем основную категорию
        await window.vacancyManager.fetchVacanciesForCategory('main', { 
          isInitialLoad: true 
        });

        // Скрываем skeleton после загрузки
        clearTimeout(skeletonTimeout);
        window.domManager.hideSkeleton('main');
        window.domManager.hideSkeleton('maybe');
        window.domManager.hideSkeleton('other');

        // Отложенная загрузка остальных данных
        setTimeout(async () => {
          try {
            // Загружаем счетчики
            const countsResult = await window.apiService.fetchCountsAll('');
            if (countsResult.success) {
              window.stateManager.updateCounts(countsResult.counts);
              Object.keys(countsResult.counts).forEach(key => {
                window.domManager.updateCounter(key, countsResult.counts[key]);
              });
            }

            // Фоновая загрузка остальных категорий
            const backgroundLoads = ['maybe', 'other']
              .filter(key => !window.stateManager.isCategoryLoadedForQuery(key))
              .map(key => 
                window.vacancyManager.fetchVacanciesForCategory(key, { isInitialLoad: false })
                  .catch(() => null)
              );

            if (backgroundLoads.length > 0) {
              await Promise.allSettled(backgroundLoads);
            }

          } catch (error) {
            console.warn('⚠️ Ошибка отложенной загрузки:', error);
          }
        }, 1000);

        window.vacancyManager.updateSearchStats();
        this.initialized = true;

        logger.log('✅ Приложение успешно инициализировано');

      } catch (error) {
        console.error('❌ Критическая ошибка инициализации:', error);
        window.domManager?.hideSkeleton('main');
        window.domManager?.hideSkeleton('maybe');
        window.domManager?.hideSkeleton('other');
        this.showCriticalError(error);
        throw error;
      }
    }

    // Настроить начальное состояние UI
    setupInitialUI() {
      // Устанавливаем начальную активную вкладку
      const containers = ['main', 'maybe', 'other'];
      containers.forEach(key => {
        const container = window.domManager.getElement(`containers.${key}`);
        if (container) {
          container.style.display = key === 'main' ? '' : 'none';
        }
      });

      // Активируем первую вкладку
      const tabButtons = window.domManager.getElement('tabButtons');
      if (tabButtons) {
        tabButtons.forEach(button => {
          const isActive = (button.dataset.target || '').endsWith('-main');
          button.classList.toggle('active', isActive);
          button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
      }
    }

    // Показать критическую ошибку
    showCriticalError(error) {
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ff4444;
        color: white;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
        z-index: 10000;
        max-width: 80%;
        font-family: 'Roboto Mono', monospace;
      `;
      
      errorDiv.innerHTML = `
        <h3>Ошибка загрузки приложения</h3>
        <p>${UTIL.escapeHtml?.(error.message) || 'Неизвестная ошибка'}</p>
        <button onclick="location.reload()" class="error-reload-btn">Перезагрузить</button>
      `;
      
      document.body.appendChild(errorDiv);
    }

    // Получить статистику приложения
    getStats() {
      if (!this.initialized) {
        return { initialized: false };
      }

      return {
        initialized: this.initialized,
        state: window.stateManager?.getStats(),
        dom: window.domManager?.getStats(),
        events: window.eventManager?.getStats(),
        vacancy: window.vacancyManager?.getStats()
      };
    }

    // Очистка при уничтожении
    destroy() {
      // Отменяем все event listeners через AbortController
      this.abortController.abort();
      
      // Fallback: ручная очистка listeners если AbortController не сработал
      for (const [key, listener] of this.eventListeners) {
        try {
          listener.element.removeEventListener(listener.event, listener.handler);
        } catch (error) {
          console.warn(`Не удалось удалить listener ${key}:`, error);
        }
      }
      this.eventListeners.clear();
      
      // Создаем новый AbortController для возможного переиспользования
      this.abortController = new AbortController();
      
      // Очищаем остальные компоненты
      window.eventManager?.destroy();
      window.stateManager?.destroy();
      window.domManager?.clearCache();
      this.initialized = false;
      this.initPromise = null;
    }
  }

  // Создаем глобальный экземпляр контроллера приложения
  window.appController = new AppController();

  // Функция для переинициализации event listeners
  function reinitializeEventHandlers() {
    logger.log('🔄 Переинициализация обработчиков событий после возврата на страницу');
    
    if (window.appController && window.appController.initialized) {
      try {
        // ВАЖНО: Сначала очищаем все старые обработчики
        if (window.eventManager && window.eventManager.removeAllListeners) {
          window.eventManager.removeAllListeners();
        }
        
        // Затем переинициализируем обработчики событий
        window.eventManager?.setupAllHandlers();
        
        // Переинициализируем свайпы если есть
        if (window.SwipeHandler && window.SwipeHandler.reinitialize) {
          window.SwipeHandler.reinitialize();
        }
        
        logger.log('✅ Обработчики событий полностью переинициализированы');
      } catch (error) {
        console.error('❌ Ошибка при переинициализации:', error);
      }
    }
  }

  // Предотвращаем дублирование переинициализации
  let reinitializationTimeout = null;
  
  function scheduleReinitialize() {
    if (reinitializationTimeout) {
      clearTimeout(reinitializationTimeout);
    }
    
    reinitializationTimeout = setTimeout(() => {
      reinitializeEventHandlers();
      reinitializationTimeout = null;
    }, 150);
  }

  // Обработчик для возврата на страницу (решает проблему с кнопками после перехода по ссылкам)
  window.addEventListener('pageshow', function(event) {
    // Если страница была восстановлена из кэша (bfcache)
    if (event.persisted) {
      logger.log('📄 Страница восстановлена из bfcache');
      scheduleReinitialize();
    }
  });

  // Обработчик для изменения видимости страницы (дополнительная защита)
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      logger.log('👁️ Страница стала видимой');
      scheduleReinitialize();
    }
  });

  // Автоматическая инициализация при загрузке скрипта
  window.appController.initialize().catch(error => {
    console.error('Не удалось инициализировать приложение:', error);
  });

})();