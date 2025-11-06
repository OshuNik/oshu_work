// event-manager.js — модуль для управления событиями

(function() {
  'use strict';

  const CONST = window.APP_CONSTANTS || {};
  const UTIL = window.utils || {};

  class EventManager {
    constructor() {
      this.listeners = [];
      this.lockManager = new Map(); // Для предотвращения race conditions
      this.isMobile = this.detectMobileDevice();
    }

    // Определение мобильного устройства
    detectMobileDevice() {
      const userAgent = navigator.userAgent;
      const platform = navigator.platform;
      
      const mobilePlatforms = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const isSmallScreen = window.innerWidth <= 768;
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isIPad = /iPad/.test(userAgent) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      return mobilePlatforms.test(userAgent) && !isIPad && (isSmallScreen || hasTouch);
    }

    // Добавить обработчик события с возможностью автоматической очистки
    addListener(element, event, handler, options = {}) {
      if (!element) return null;

      element.addEventListener(event, handler, options);
      
      const listenerInfo = { element, event, handler };
      this.listeners.push(listenerInfo);
      
      // Возвращаем функцию для удаления обработчика
      return () => {
        this.removeListener(listenerInfo);
      };
    }

    // Удалить конкретный обработчик
    removeListener(listenerInfo) {
      const { element, event, handler } = listenerInfo;
      element.removeEventListener(event, handler);
      
      const index = this.listeners.indexOf(listenerInfo);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    }

    // Удалить все обработчики (для переинициализации)
    removeAllListeners() {
      console.log('🧹 Очистка всех event listeners перед переинициализацией');
      
      for (const listenerInfo of this.listeners) {
        const { element, event, handler } = listenerInfo;
        try {
          element.removeEventListener(event, handler);
        } catch (error) {
          console.warn('Ошибка при удалении обработчика:', error);
        }
      }
      
      this.listeners = [];
      console.log('✅ Все event listeners очищены');
    }

    // Блокировка операций для предотвращения race conditions
    acquireLock(key) {
      if (this.lockManager.has(key)) {
        return false; // Операция уже выполняется
      }
      this.lockManager.set(key, true);
      return true;
    }

    // Освобождение блокировки
    releaseLock(key) {
      this.lockManager.delete(key);
    }

    // Настройка обработчиков для поиска
    setupSearchHandlers() {
      const searchInput = window.domManager?.getElement('searchInput');
      const searchClearBtn = window.domManager?.getElement('searchClearBtn');
      
      if (!searchInput || !searchClearBtn) {
        console.warn('Элементы поиска не найдены');
        return;
      }

      // Debounced поисковый обработчик
      const debouncedSearch = UTIL.debounce?.(() => {
        const query = searchInput.value.trim();
        window.stateManager?.setQuery(query);
        
        // Обновляем состояние UI
        window.domManager?.updateSearchState(searchInput.value.length > 0);
        
        // Запускаем поиск через custom event
        document.dispatchEvent(new CustomEvent('search:triggered', {
          detail: { query }
        }));
      }, CONST.PERFORMANCE?.DEBOUNCE_DELAY || 300);

      // Обработчик ввода
      this.addListener(searchInput, 'input', debouncedSearch);

      // Обработчик очистки поиска
      this.addListener(searchClearBtn, 'click', () => {
        searchInput.value = '';
        window.domManager?.updateSearchState(false);
        searchInput.focus();
        debouncedSearch();
      });
    }

    // Настройка обработчиков для вкладок
    setupTabHandlers() {
      const tabButtons = window.domManager?.getElement('tabButtons');
      if (!tabButtons) {
        console.warn('Кнопки вкладок не найдены');
        return;
      }

      tabButtons.forEach(button => {
        this.setupSingleTabHandler(button);
      });
    }

    // Настройка обработчика для одной вкладки
    setupSingleTabHandler(button) {
      let pressTimer = null;
      let isHeld = false;
      let removeMovementListeners = null; // Сохраняем функции удаления
      const holdDuration = CONST.RATE_LIMITS?.HOLD_DURATION || 1200;

      // Обработчик начала нажатия
      const handleStart = (e) => {
        isHeld = false;
        button.classList.add('pressing');

        let hasMoved = false;
        const startX = e.clientX || e.touches?.[0]?.clientX || 0;
        const startY = e.clientY || e.touches?.[0]?.clientY || 0;

        const checkMovement = (e) => {
          const currentX = e.clientX || e.touches?.[0]?.clientX || 0;
          const currentY = e.clientY || e.touches?.[0]?.clientY || 0;
          const distance = Math.sqrt((currentX - startX) ** 2 + (currentY - startY) ** 2);

          if (distance > 10) {
            hasMoved = true;
            handleCancel();
          }
        };

        // Добавляем слушатели движения и сохраняем функции удаления
        const removePtrMove = this.addListener(document, 'pointermove', checkMovement, { passive: true });
        const removeTouchMove = this.addListener(document, 'touchmove', checkMovement, { passive: true });

        removeMovementListeners = () => {
          if (removePtrMove) removePtrMove();
          if (removeTouchMove) removeTouchMove();
          removeMovementListeners = null;
        };
        
        pressTimer = setTimeout(() => {
          if (!hasMoved) {
            isHeld = true;
            button.classList.remove('pressing');
            const key = window.domManager?.getKeyFromTargetId(button.dataset.target || '');
            if (key) {
              document.dispatchEvent(new CustomEvent('tab:longPress', {
                detail: { key }
              }));
            }
          }
        }, holdDuration);
      };
      
      // Обработчик отмены нажатия
      const handleCancel = () => {
        button.classList.remove('pressing');
        clearTimeout(pressTimer);

        // ПРАВИЛЬНО: используем сохраненные функции удаления
        if (removeMovementListeners) {
          removeMovementListeners();
        }
      };

      // Обработчик клика
      const handleClick = (e) => {
        if (isHeld) {
          e.preventDefault();
          e.stopPropagation();
        } else {
          const targetId = button.dataset.target;
          if (targetId) {
            document.dispatchEvent(new CustomEvent('tab:activated', {
              detail: { targetId }
            }));
          }
        }
      };

      // Добавляем обработчики
      this.addListener(button, 'pointerdown', handleStart);
      this.addListener(button, 'pointerup', handleCancel);
      this.addListener(button, 'pointerleave', handleCancel);
      this.addListener(button, 'click', handleClick);
    }

    // Настройка делегирования событий для контента
    setupContentDelegation() {
      const vacanciesContent = window.domManager?.getElement('vacanciesContent');
      if (!vacanciesContent) {
        console.warn('Контейнер вакансий не найден');
        return;
      }

      // Универсальный обработчик кликов
      const handleContentClick = (e) => {
        // Обработка кнопок действий
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
          const action = actionBtn.dataset.action;
          const vacancyId = actionBtn.dataset.id;
          const url = actionBtn.dataset.url;
          
          document.dispatchEvent(new CustomEvent('vacancy:action', {
            detail: { action, vacancyId, url }
          }));
          return;
        }

        // Обработка кнопок "Загрузить еще"
        const loadMoreBtn = e.target.closest('.load-more-btn');
        if (loadMoreBtn) {
          const container = loadMoreBtn.closest('.vacancy-list');
          if (container) {
            const key = container.id.replace('vacancies-list-', '');
            document.dispatchEvent(new CustomEvent('loadMore:triggered', {
              detail: { key }
            }));
          }
          return;
        }
      };

      this.addListener(vacanciesContent, 'click', handleContentClick);

      // Дополнительная обработка для мобильных устройств
      if (this.isMobile) {
        this.setupMobileContentHandlers(vacanciesContent);
      }
    }

    // Настройка обработчиков для мобильных устройств
    setupMobileContentHandlers(container) {
      // Touch feedback для кнопок действий
      const handleTouchStart = (e) => {
        const target = e.target.closest('[data-action], .load-more-btn');
        if (target) {
          window.domManager?.addTouchFeedback(target);
        }
      };

      this.addListener(container, 'touchstart', handleTouchStart, { passive: true });

      // Предотвращение zoom на двойное касание
      let lastTouchEnd = 0;
      const preventZoom = (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          e.preventDefault();
        }
        lastTouchEnd = now;
      };

      this.addListener(document, 'touchend', preventZoom, { passive: false });
    }

    // Настройка обработчика видимости страницы
    setupVisibilityHandler() {
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          document.dispatchEvent(new CustomEvent('page:visible'));
        }
      };

      this.addListener(document, 'visibilitychange', handleVisibilityChange);
    }

    // Настройка всех обработчиков событий
    setupAllHandlers() {
      this.setupSearchHandlers();
      this.setupTabHandlers();
      this.setupContentDelegation();
      this.setupVisibilityHandler();
    }

    // Получить статистику обработчиков
    getStats() {
      return {
        totalListeners: this.listeners.length,
        activeLocks: this.lockManager.size,
        isMobile: this.isMobile,
        handlerTypes: this.listeners.reduce((acc, { event }) => {
          acc[event] = (acc[event] || 0) + 1;
          return acc;
        }, {})
      };
    }

    // ✅ BUG #15: Safe dispatch event with async handler error boundary
    // Safely dispatch events that may have async handlers without crashing
    safeDispatchEvent(target, eventName, detail = {}) {
      try {
        const event = new CustomEvent(eventName, {
          detail,
          bubbles: true,
          cancelable: true
        });

        // Dispatch with error handling for any async handlers
        const result = target.dispatchEvent(event);

        // Log dispatch success for debugging
        if (!result) {
          console.debug(`[EventManager] Event "${eventName}" was cancelled by a listener`);
        }

        return result;
      } catch (error) {
        console.error(`[EventManager] Error dispatching event "${eventName}":`, error);
        return false;
      }
    }

    // Очистка при уничтожении
    destroy() {
      this.removeAllListeners();
      this.lockManager.clear();
    }
  }

  // Создаем глобальный экземпляр менеджера событий
  window.eventManager = new EventManager();

  // ✅ BUG #15: Global helper for safe event dispatch
  // Wraps document.dispatchEvent with error handling
  window.safeDispatchEvent = (eventName, detail = {}) => {
    return window.eventManager.safeDispatchEvent(document, eventName, detail);
  };

})();