// state-manager.js — управление состоянием приложения

(function () {
  'use strict';

  const CONST = window.APP_CONSTANTS || {};

  class StateManager {
    constructor() {
      this.state = {
        query: '',
        activeKey: 'main',
        main: { offset: 0, total: 0, busy: false, loadedOnce: false, loadedForQuery: '' },
        maybe: { offset: 0, total: 0, busy: false, loadedOnce: false, loadedForQuery: '' },
        other: { offset: 0, total: 0, busy: false, loadedOnce: false, loadedForQuery: '' }
      };

      this.currentController = null;
      this.listeners = new Map();
      this.VALID_CATEGORIES = new Set(['main', 'maybe', 'other']);
      this.MAX_QUERY_LENGTH = 500;
    }

    // ✅ BUG #11: Validate category key
    validateCategoryKey(key) {
      if (!this.VALID_CATEGORIES.has(key)) {
        console.warn(`[StateManager] Invalid category key: "${key}". Expected one of: ${Array.from(this.VALID_CATEGORIES).join(', ')}`);
        return false;
      }
      return true;
    }

    // ✅ BUG #11: Validate category state updates
    validateCategoryStateUpdates(key, updates) {
      if (!updates || typeof updates !== 'object') {
        console.warn('[StateManager] Category state updates must be an object');
        return false;
      }

      const validKeys = ['offset', 'total', 'busy', 'loadedOnce', 'loadedForQuery'];

      for (const [updateKey, value] of Object.entries(updates)) {
        // Only validate keys that are being updated
        if (!validKeys.includes(updateKey)) {
          console.warn(`[StateManager] Unknown state property: "${updateKey}". Valid: ${validKeys.join(', ')}`);
          return false;
        }

        // Type validation
        if (updateKey === 'offset' || updateKey === 'total') {
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            console.warn(`[StateManager] "${updateKey}" must be a finite number, got: ${typeof value} = ${value}`);
            return false;
          }
          if (value < 0) {
            console.warn(`[StateManager] "${updateKey}" must be >= 0, got: ${value}`);
            return false;
          }
        }

        if (updateKey === 'busy' || updateKey === 'loadedOnce') {
          if (typeof value !== 'boolean') {
            console.warn(`[StateManager] "${updateKey}" must be boolean, got: ${typeof value}`);
            return false;
          }
        }

        if (updateKey === 'loadedForQuery') {
          if (typeof value !== 'string') {
            console.warn(`[StateManager] "loadedForQuery" must be string, got: ${typeof value}`);
            return false;
          }
          if (value.length > this.MAX_QUERY_LENGTH) {
            console.warn(`[StateManager] "loadedForQuery" exceeds max length ${this.MAX_QUERY_LENGTH}`);
            return false;
          }
        }
      }

      // Cross-property validation: offset must be <= total
      if ('offset' in updates || 'total' in updates) {
        const offset = updates.offset ?? this.state[key]?.offset ?? 0;
        const total = updates.total ?? this.state[key]?.total ?? 0;

        if (offset > total) {
          console.warn(`[StateManager] offset (${offset}) cannot exceed total (${total})`);
          return false;
        }
      }

      return true;
    }

    // ✅ BUG #11: Validate query string
    validateQuery(query) {
      if (typeof query !== 'string') {
        console.warn('[StateManager] Query must be a string');
        return false;
      }
      if (query.length > this.MAX_QUERY_LENGTH) {
        console.warn(`[StateManager] Query exceeds max length ${this.MAX_QUERY_LENGTH}`);
        return false;
      }
      return true;
    }

    // ✅ BUG #11: Validate counts object
    validateCounts(counts) {
      if (!counts || typeof counts !== 'object') {
        console.warn('[StateManager] Counts must be an object');
        return false;
      }

      for (const [key, count] of Object.entries(counts)) {
        if (!this.VALID_CATEGORIES.has(key)) {
          console.warn(`[StateManager] Unknown category in counts: "${key}"`);
          return false;
        }
        if (typeof count !== 'number' || !Number.isFinite(count)) {
          console.warn(`[StateManager] Count for "${key}" must be finite number, got: ${typeof count} = ${count}`);
          return false;
        }
        if (count < 0) {
          console.warn(`[StateManager] Count for "${key}" must be >= 0, got: ${count}`);
          return false;
        }
      }

      return true;
    }

    // Получить текущее состояние
    getState() {
      return { ...this.state };
    }

    // Получить состояние конкретной категории
    getCategoryState(key) {
      return { ...this.state[key] };
    }

    // Обновить состояние категории
    // ✅ BUG #11: Add validation before mutation
    updateCategoryState(key, updates) {
      if (!this.validateCategoryKey(key)) return;
      if (!this.validateCategoryStateUpdates(key, updates)) return;

      if (this.state[key]) {
        const oldState = { ...this.state[key] };
        this.state[key] = { ...this.state[key], ...updates };

        // Log significant state changes for debugging
        console.debug(`[StateManager] Category "${key}" state updated:`, {
          changes: updates,
          newState: this.state[key]
        });

        this.notifyListeners('categoryStateChanged', { key, state: this.state[key] });
      }
    }

    // Обновить активную категорию
    // ✅ BUG #11: Add validation before mutation
    setActiveCategory(key) {
      if (!this.validateCategoryKey(key)) return;

      if (this.state.activeKey !== key) {
        console.debug(`[StateManager] Active category changed: "${this.state.activeKey}" → "${key}"`);
        this.state.activeKey = key;
        this.notifyListeners('activeCategoryChanged', key);
      }
    }

    // Обновить поисковый запрос
    // ✅ BUG #11: Add validation before mutation
    setQuery(query) {
      if (!this.validateQuery(query)) return;

      const trimmedQuery = query.trim();
      if (this.state.query !== trimmedQuery) {
        console.debug(`[StateManager] Query changed: "${this.state.query}" → "${trimmedQuery}"`);
        this.state.query = trimmedQuery;
        this.notifyListeners('queryChanged', trimmedQuery);
      }
    }

    // Сбросить состояние категории
    // ✅ BUG #11: Add validation before mutation
    resetCategoryState(key) {
      if (!this.validateCategoryKey(key)) return;

      if (this.state[key]) {
        console.debug(`[StateManager] Category "${key}" state reset`);
        this.state[key] = { offset: 0, total: 0, busy: false, loadedOnce: false, loadedForQuery: '' };
        this.notifyListeners('categoryStateReset', key);
      }
    }

    // Сбросить все состояния
    resetAllStates() {
      ['main', 'maybe', 'other'].forEach(key => {
        this.resetCategoryState(key);
      });
    }

    // Проверить, загружена ли категория для текущего запроса
    isCategoryLoadedForQuery(key) {
      const categoryState = this.state[key];
      return categoryState.loadedOnce && categoryState.loadedForQuery === this.state.query;
    }

    // Проверить, занята ли категория
    isCategoryBusy(key) {
      return this.state[key]?.busy || false;
    }

    // Установить занятость категории
    setCategoryBusy(key, busy) {
      this.updateCategoryState(key, { busy });
    }

    // Обновить счетчики
    // ✅ BUG #11: Add validation before mutation
    updateCounts(counts) {
      if (!this.validateCounts(counts)) return;

      Object.keys(counts).forEach(key => {
        if (this.state[key]) {
          this.updateCategoryState(key, { total: counts[key] });
        }
      });

      console.debug('[StateManager] Counts updated:', counts);
      this.notifyListeners('countsUpdated', counts);
    }

    // Управление AbortController
    getCurrentController() {
      return this.currentController;
    }

    setCurrentController(controller) {
      this.currentController = controller;
    }

    abortCurrentRequest() {
      if (this.currentController && !this.currentController.signal.aborted) {
        try {
          this.currentController.abort();
        } catch (error) {
          console.warn('Ошибка отмены запроса:', error);
        }
      }
      this.currentController = new AbortController();
      return this.currentController;
    }

    // Система подписок на изменения состояния
    subscribe(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set());
      }
      this.listeners.get(event).add(callback);
      
      // Возвращаем функцию для отписки
      return () => {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
          callbacks.delete(callback);
        }
      };
    }

    // Уведомить подписчиков
    notifyListeners(event, data) {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Ошибка в обработчике события ${event}:`, error);
          }
        });
      }
    }

    // Получить статистику состояния
    getStats() {
      const stats = {
        totalVacancies: 0,
        loadedVacancies: 0,
        busyCategories: 0,
        activeCategory: this.state.activeKey
      };

      ['main', 'maybe', 'other'].forEach(key => {
        const categoryState = this.state[key];
        stats.totalVacancies += categoryState.total || 0;
        if (categoryState.loadedOnce) {
          stats.loadedVacancies++;
        }
        if (categoryState.busy) {
          stats.busyCategories++;
        }
      });

      return stats;
    }

    // Получить название текущей активной категории
    getCurrentCategory() {
      const categoryMap = {
        'main': 'ТОЧНО ТВОЁ',
        'maybe': 'МОЖЕТ БЫТЬ',
        'other': 'НЕ ТВОЁ'
      };
      return categoryMap[this.state.activeKey] || 'ТОЧНО ТВОЁ';
    }

    // Очистить все подписки
    destroy() {
      this.listeners.clear();
      this.abortCurrentRequest();
    }
  }

  // Создаем глобальный экземпляр менеджера состояния
  window.stateManager = new StateManager();

})();
