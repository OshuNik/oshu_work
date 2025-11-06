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

    // ✅ Управление AbortController с валидацией
    getCurrentController() {
      return this.currentController;
    }

    // ✅ VALIDATION: Validate AbortController before setting
    setCurrentController(controller) {
      // Валидируем что это valid AbortController
      if (controller !== null && !(controller instanceof AbortController)) {
        console.warn('[StateManager] setCurrentController: Invalid controller, must be AbortController instance or null');
        return false;
      }

      this.currentController = controller;
      console.debug('[StateManager] AbortController updated');
      return true;
    }

    // ✅ VALIDATION: Abort with proper error handling and state validation
    abortCurrentRequest() {
      try {
        if (this.currentController && !this.currentController.signal.aborted) {
          // Проверяем что это valid controller перед abort
          if (!(this.currentController instanceof AbortController)) {
            console.warn('[StateManager] Current controller is not valid AbortController');
            this.currentController = new AbortController();
            return this.currentController;
          }

          this.currentController.abort();
          console.debug('[StateManager] Current request aborted');
        }
      } catch (error) {
        console.error('[StateManager] Error aborting request:', error);
      }

      // Всегда создаем новый controller для следующего запроса
      try {
        this.currentController = new AbortController();
      } catch (error) {
        console.error('[StateManager] Failed to create new AbortController:', error);
        this.currentController = null;
      }

      return this.currentController;
    }

    // ✅ Система подписок на изменения состояния с валидацией
    subscribe(event, callback) {
      // VALIDATION: Check event name
      if (!event || typeof event !== 'string') {
        console.warn('[StateManager] subscribe: Event name must be a non-empty string');
        return () => {}; // Return no-op unsubscribe function
      }

      // VALIDATION: Check callback is a function
      if (typeof callback !== 'function') {
        console.warn('[StateManager] subscribe: Callback must be a function');
        return () => {}; // Return no-op unsubscribe function
      }

      // VALIDATION: Check event name is allowed
      const VALID_EVENTS = new Set([
        'categoryStateChanged',
        'activeCategoryChanged',
        'queryChanged',
        'categoryStateReset',
        'countsUpdated'
      ]);

      if (!VALID_EVENTS.has(event)) {
        console.warn(`[StateManager] subscribe: Unknown event "${event}". Valid events: ${Array.from(VALID_EVENTS).join(', ')}`);
        return () => {}; // Return no-op unsubscribe function
      }

      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set());
      }

      const callbacks = this.listeners.get(event);

      // VALIDATION: Prevent duplicate subscriptions from same callback
      if (callbacks.has(callback)) {
        console.warn('[StateManager] subscribe: This callback is already subscribed to this event');
        return () => {}; // Return no-op unsubscribe function
      }

      callbacks.add(callback);
      console.debug(`[StateManager] Listener subscribed to "${event}"`);

      // Возвращаем функцию для отписки
      return () => {
        const listeners = this.listeners.get(event);
        if (listeners) {
          listeners.delete(callback);
          console.debug(`[StateManager] Listener unsubscribed from "${event}"`);
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
