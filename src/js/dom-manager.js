// dom-manager.js — модуль для управления DOM элементами

(function() {
  'use strict';

  const CONST = window.APP_CONSTANTS || {};
  const UTIL = window.utils || {};

  class DOMManager {
    constructor() {
      this.elements = {};
      this.cached = false;
    }

    // Кэширование DOM элементов
    cacheElements() {
      if (this.cached) return;

      this.elements = {
        // Основные контейнеры
        containers: {
          main: document.getElementById('vacancies-list-main'),
          maybe: document.getElementById('vacancies-list-maybe'),
          other: document.getElementById('vacancies-list-other'),
        },
        
        // Счетчики
        counts: {
          main: document.getElementById('count-main'),
          maybe: document.getElementById('count-maybe'),
          other: document.getElementById('count-other'),
        },

        // UI элементы
        tabButtons: document.querySelectorAll('.tab-button'),
        vacancyLists: document.querySelectorAll('.vacancy-list'),
        searchInput: document.getElementById('search-input'),
        searchClearBtn: document.getElementById('search-clear-btn'),
        searchInputWrapper: null, // Будет установлен динамически
        mainHeader: document.getElementById('main-header'),
        vacanciesContent: document.getElementById('vacancies-content'),
        loader: document.getElementById('loader'),
      };

      // Устанавливаем wrapper для поиска
      if (this.elements.searchInput) {
        this.elements.searchInputWrapper = this.elements.searchInput.parentElement;
      }

      this.cached = true;
    }

    // Получить элемент по ключу (поддерживает array access как "containers.0")
    getElement(path) {
      if (!path || typeof path !== 'string') {
        console.warn('[DOMManager] Invalid path:', path);
        return null;
      }

      if (!this.cached) this.cacheElements();

      const keys = path.split('.');
      let element = this.elements;

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        // Проверяем существование элемента перед доступом
        if (element === null || element === undefined) {
          console.warn('[DOMManager] Cannot access property', key, 'of', element);
          return null;
        }

        // Проверяем, это ли числовой индекс
        if (/^\d+$/.test(key)) {
          const index = parseInt(key, 10);

          // Проверяем, это ли массив
          if (!Array.isArray(element)) {
            console.warn('[DOMManager] Expected array at path', keys.slice(0, i).join('.'), 'but got', typeof element);
            return null;
          }

          // Проверяем границы массива
          if (index < 0 || index >= element.length) {
            console.warn('[DOMManager] Array index out of bounds:', index, 'length:', element.length);
            return null;
          }

          element = element[index];
        } else {
          // Обычный доступ к свойству
          element = element[key];
        }

        if (!element) return null;
      }

      return element;
    }

    // Проверить наличие критических элементов
    validateCriticalElements() {
      if (!this.cached) this.cacheElements();

      const critical = [
        'containers.main',
        'containers.maybe',
        'containers.other',
        'counts.main',
        'counts.maybe',
        'counts.other',
        'tabButtons',
        'vacancyLists',
        'searchInput',
        'loader'
      ];

      const missing = critical.filter(path => {
        const element = this.getElement(path);
        return !element || (Array.isArray(element) && element.length === 0);
      });

      if (missing.length > 0) {
        console.error('❌ Отсутствуют критические элементы:', missing);
        return false;
      }

      return true;
    }

    // Показать лоадер
    showLoader() {
      const loader = this.getElement('loader');
      if (loader) {
        loader.classList.remove(CONST.CSS_CLASSES?.HIDDEN || 'hidden');
        loader.classList.add(CONST.CSS_CLASSES?.LOADING || 'loading');
      }
    }

    // Скрыть лоадер
    hideLoader() {
      const loader = this.getElement('loader');
      if (loader) {
        loader.classList.remove(CONST.CSS_CLASSES?.LOADING || 'loading');
        loader.classList.add(CONST.CSS_CLASSES?.HIDDEN || 'hidden');
      }
    }

    // Очистить контейнер
    clearContainer(containerKey) {
      const container = this.getElement(`containers.${containerKey}`);
      if (!container) return;

      const loadMoreWrap = container.querySelector('.load-more-wrap');
      container.innerHTML = '';
      if (loadMoreWrap) {
        container.appendChild(loadMoreWrap);
      }
    }

    // Показать skeleton loader
    showSkeleton(containerKey, count = 3) {
      const container = this.getElement(`containers.${containerKey}`);
      if (!container) return;

      // Очищаем контейнер сначала
      this.clearContainer(containerKey);

      // ✅ FIX: Создаем skeleton карточки используя безопасные DOM методы
      const skeletonContainer = document.createElement('div');
      skeletonContainer.className = 'skeleton-container';

      // Используем DocumentFragment для эффективной вставки
      const fragment = document.createDocumentFragment();
      const skeletonHTML = this.createSkeletonCard();
      const tempDiv = document.createElement('div');

      for (let i = 0; i < count; i++) {
        // ✅ SAFE: innerHTML используется только с статическим HTML из createSkeletonCard()
        tempDiv.innerHTML = skeletonHTML;
        while (tempDiv.firstChild) {
          fragment.appendChild(tempDiv.firstChild);
        }
      }

      skeletonContainer.appendChild(fragment);
      container.appendChild(skeletonContainer);
    }

    // Скрыть skeleton loader
    hideSkeleton(containerKey) {
      const container = this.getElement(`containers.${containerKey}`);
      if (!container) return;

      const skeletonContainer = container.querySelector('.skeleton-container');
      if (skeletonContainer) {
        skeletonContainer.classList.add('skeleton-hidden');
        setTimeout(() => {
          if (skeletonContainer.parentNode) {
            skeletonContainer.parentNode.removeChild(skeletonContainer);
          }
        }, 300);
      }
    }

    // Создать HTML skeleton карточки
    createSkeletonCard() {
      return `
        <div class="vacancy-card-skeleton">
          <div class="skeleton skeleton-header"></div>
          <div class="skeleton skeleton-text long"></div>
          <div class="skeleton skeleton-text medium"></div>
          <div class="skeleton skeleton-text short"></div>
          <div class="skeleton-footer">
            <div class="skeleton skeleton-tag"></div>
            <div class="skeleton skeleton-meta"></div>
          </div>
        </div>
      `;
    }

    // Обновить счетчик
    updateCounter(key, count) {
      const counter = this.getElement(`counts.${key}`);
      if (counter) {
        counter.textContent = count;
      }
    }

    // Показать только активную вкладку
    showOnlyActiveTab(targetId) {
      const vacancyLists = this.getElement('vacancyLists');
      if (!vacancyLists) return;

      vacancyLists.forEach(list => {
        const isActive = list.id === targetId;
        list.classList.toggle(CONST.CSS_CLASSES?.ACTIVE || 'active', isActive);
        list.style.display = isActive ? '' : 'none';
        
        // Управляем aria-hidden для accessibility
        if (isActive) {
          list.removeAttribute('aria-hidden');
        } else {
          list.setAttribute('aria-hidden', 'true');
        }
      });
    }

    // Активировать вкладку
    activateTab(targetId) {
      const tabButtons = this.getElement('tabButtons');
      if (!tabButtons) return;

      tabButtons.forEach(button => {
        const isActive = button.dataset.target === targetId;
        button.classList.toggle(CONST.CSS_CLASSES?.ACTIVE || 'active', isActive);
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    }

    // Обновить состояние поля поиска
    updateSearchState(hasText) {
      const wrapper = this.getElement('searchInputWrapper');
      if (wrapper) {
        wrapper.classList.toggle('has-text', hasText);
      }
    }

    // Получить ключ категории из ID цели
    getKeyFromTargetId(targetId) {
      if (targetId.endsWith('-main')) return 'main';
      if (targetId.endsWith('-maybe')) return 'maybe';
      return 'other';
    }

    // Скрыть кнопку "Загрузить еще"
    hideLoadMore(containerKey) {
      const container = this.getElement(`containers.${containerKey}`);
      if (!container) return;

      const loadMoreWrap = container.querySelector('.load-more-wrap');
      if (loadMoreWrap) {
        loadMoreWrap.remove();
      }
    }

    // Переместить кнопку "Загрузить еще" в конец контейнера
    pinLoadMoreToBottom(containerKey) {
      const container = this.getElement(`containers.${containerKey}`);
      if (!container) return;

      const loadMoreWrap = container.querySelector('.load-more-wrap');
      if (loadMoreWrap) {
        container.appendChild(loadMoreWrap);
      }
    }

    // Создать UI для поисковой статистики
    ensureSearchStatsUI() {
      const searchContainer = document.getElementById('search-container');
      const searchInputWrapper = this.getElement('searchInputWrapper');
      
      if (!searchContainer || !searchInputWrapper) return null;

      let searchStatsEl = document.querySelector('.search-stats');
      if (!searchStatsEl) {
        searchStatsEl = document.createElement('div');
        searchStatsEl.className = 'search-stats';
        searchInputWrapper.insertAdjacentElement('afterend', searchStatsEl);
      }

      return searchStatsEl;
    }

    // Обновить поисковую статистику
    updateSearchStats(visible, total, query) {
      const searchStatsEl = this.ensureSearchStatsUI();
      if (!searchStatsEl) return;

      const trimmedQuery = (query || '').trim();
      
      let statsText = '';
      if (trimmedQuery) {
        if (visible === 0) {
          statsText = CONST.MESSAGES?.SEARCH?.NOTHING_FOUND || 'Ничего не найдено';
        } else {
          const template = CONST.MESSAGES?.SEARCH?.FOUND_COUNT || 'Найдено: {visible} из {total}';
          statsText = template.replace('{visible}', visible).replace('{total}', total);
        }
      }

      searchStatsEl.textContent = statsText;
    }

    // Добавить визуальную обратную связь для touch
    addTouchFeedback(element, options = {}) {
      if (!element) return;

      const { opacity = '0.7', scale = '0.98', duration = 150 } = options;
      
      element.style.opacity = opacity;
      if (scale !== '1') {
        element.style.transform = `scale(${scale})`;
      }
      
      setTimeout(() => {
        element.style.opacity = '';
        element.style.transform = '';
      }, duration);
    }

    // Очистить кэш (для тестирования)
    clearCache() {
      this.elements = {};
      this.cached = false;
    }

    // Получить статистику DOM элементов
    getStats() {
      if (!this.cached) this.cacheElements();

      const stats = {
        cachedElements: Object.keys(this.elements).length,
        criticalElementsValid: this.validateCriticalElements(),
        containersCount: Object.keys(this.elements.containers || {}).length,
        countersCount: Object.keys(this.elements.counts || {}).length,
        tabButtonsCount: (this.elements.tabButtons || []).length,
        vacancyListsCount: (this.elements.vacancyLists || []).length
      };

      return stats;
    }
  }

  // Создаем глобальный экземпляр DOM менеджера
  window.domManager = new DOMManager();

})();