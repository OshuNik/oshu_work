// advanced-rate-limiter.js - Продвинутый rate limiter с разными лимитами для операций

(function() {
  'use strict';

  class AdvancedRateLimiter {
    constructor() {
      // Лимиты для разных типов операций
      this.limits = {
        // API Requests
        fetchVacancies: { maxRequests: 30, windowMs: 60000 }, // 30 req/min
        updateStatus: { maxRequests: 20, windowMs: 60000 },    // 20 req/min
        favorite: { maxRequests: 10, windowMs: 60000 },        // 10 req/min

        // Settings Operations
        saveSettings: { maxRequests: 5, windowMs: 60000 },     // 5 req/min
        addKeyword: { maxRequests: 10, windowMs: 60000 },      // 10 req/min
        addChannel: { maxRequests: 10, windowMs: 60000 },      // 10 req/min
        deleteKeyword: { maxRequests: 15, windowMs: 60000 },   // 15 req/min
        deleteChannel: { maxRequests: 15, windowMs: 60000 },   // 15 req/min

        // Search
        search: { maxRequests: 30, windowMs: 60000 },          // 30 req/min

        // Bulk operations (more restrictive)
        bulkDelete: { maxRequests: 3, windowMs: 60000 },       // 3 req/min
      };

      // Храним историю requests для каждой операции
      this.requestHistory = new Map();

      // Глобальный лимит (защита от abuse)
      this.globalLimit = { maxRequests: 100, windowMs: 60000 }; // 100 req/min total
      this.globalHistory = [];

      // Статистика
      this.stats = {
        totalRequests: 0,
        blockedRequests: 0,
        operationStats: {}
      };
    }

    /**
     * Проверить можно ли выполнить операцию
     * @param {string} operation - Тип операции (fetchVacancies, updateStatus, etc.)
     * @returns {{allowed: boolean, message: string, retryAfter: number}}
     */
    checkLimit(operation) {
      this.stats.totalRequests++;

      // Проверяем глобальный лимит
      const globalCheck = this._checkGlobalLimit();
      if (!globalCheck.allowed) {
        this.stats.blockedRequests++;
        this._updateOperationStats(operation, false);
        return globalCheck;
      }

      // Проверяем лимит для конкретной операции
      const limit = this.limits[operation];
      if (!limit) {
        // Если операция не определена, используем дефолтный лимит
        console.warn(`[Rate Limiter] Unknown operation "${operation}", using default limit`);
        this._updateOperationStats(operation, true);
        return { allowed: true, message: '', retryAfter: 0 };
      }

      const now = Date.now();
      const history = this.requestHistory.get(operation) || [];

      // Удаляем старые записи (вне окна)
      const activeRequests = history.filter(timestamp => now - timestamp < limit.windowMs);

      // Проверяем лимит
      if (activeRequests.length >= limit.maxRequests) {
        const oldestRequest = Math.min(...activeRequests);
        const retryAfter = Math.ceil((oldestRequest + limit.windowMs - now) / 1000);

        this.stats.blockedRequests++;
        this._updateOperationStats(operation, false);

        return {
          allowed: false,
          message: `Слишком много запросов (${operation}). Подождите ${retryAfter} сек.`,
          retryAfter
        };
      }

      // Добавляем новый request в историю
      activeRequests.push(now);
      this.requestHistory.set(operation, activeRequests);

      // Обновляем глобальную историю
      this.globalHistory.push(now);

      this._updateOperationStats(operation, true);

      return { allowed: true, message: '', retryAfter: 0 };
    }

    /**
     * Проверить глобальный лимит (защита от общего abuse)
     * @private
     */
    _checkGlobalLimit() {
      const now = Date.now();
      const activeGlobalRequests = this.globalHistory.filter(
        timestamp => now - timestamp < this.globalLimit.windowMs
      );

      if (activeGlobalRequests.length >= this.globalLimit.maxRequests) {
        const oldestRequest = Math.min(...activeGlobalRequests);
        const retryAfter = Math.ceil((oldestRequest + this.globalLimit.windowMs - now) / 1000);

        return {
          allowed: false,
          message: `Превышен глобальный лимит запросов. Подождите ${retryAfter} сек.`,
          retryAfter
        };
      }

      // Обновляем глобальную историю
      this.globalHistory = activeGlobalRequests;

      return { allowed: true, message: '', retryAfter: 0 };
    }

    /**
     * Обновить статистику по операции
     * @private
     */
    _updateOperationStats(operation, allowed) {
      if (!this.stats.operationStats[operation]) {
        this.stats.operationStats[operation] = {
          allowed: 0,
          blocked: 0
        };
      }

      if (allowed) {
        this.stats.operationStats[operation].allowed++;
      } else {
        this.stats.operationStats[operation].blocked++;
      }
    }

    /**
     * Получить статистику использования
     * @returns {Object} Статистика по всем операциям
     */
    getStats() {
      const now = Date.now();
      const stats = {};

      for (const [operation, history] of this.requestHistory.entries()) {
        const limit = this.limits[operation];
        const activeRequests = history.filter(
          timestamp => now - timestamp < limit.windowMs
        );

        stats[operation] = {
          used: activeRequests.length,
          max: limit.maxRequests,
          remaining: limit.maxRequests - activeRequests.length,
          resetIn: Math.ceil((limit.windowMs - (now - Math.min(...activeRequests))) / 1000), // seconds
          utilization: Math.round((activeRequests.length / limit.maxRequests) * 100) // percentage
        };
      }

      const activeGlobal = this.globalHistory.filter(
        timestamp => now - timestamp < this.globalLimit.windowMs
      );

      stats.global = {
        used: activeGlobal.length,
        max: this.globalLimit.maxRequests,
        remaining: this.globalLimit.maxRequests - activeGlobal.length,
        utilization: Math.round((activeGlobal.length / this.globalLimit.maxRequests) * 100)
      };

      stats.summary = {
        totalRequests: this.stats.totalRequests,
        blockedRequests: this.stats.blockedRequests,
        successRate: this.stats.totalRequests > 0
          ? Math.round(((this.stats.totalRequests - this.stats.blockedRequests) / this.stats.totalRequests) * 100)
          : 100
      };

      stats.operations = { ...this.stats.operationStats };

      return stats;
    }

    /**
     * Получить простую статистику для конкретной операции
     * @param {string} operation - Название операции
     * @returns {Object|null}
     */
    getOperationStats(operation) {
      const limit = this.limits[operation];
      if (!limit) return null;

      const now = Date.now();
      const history = this.requestHistory.get(operation) || [];
      const activeRequests = history.filter(
        timestamp => now - timestamp < limit.windowMs
      );

      return {
        operation,
        used: activeRequests.length,
        max: limit.maxRequests,
        remaining: limit.maxRequests - activeRequests.length,
        windowMs: limit.windowMs
      };
    }

    /**
     * Сбросить лимиты (для тестирования)
     */
    reset() {
      this.requestHistory.clear();
      this.globalHistory = [];
      this.stats = {
        totalRequests: 0,
        blockedRequests: 0,
        operationStats: {}
      };
      console.log('[Rate Limiter] All limits reset');
    }

    /**
     * Сбросить лимиты для конкретной операции
     * @param {string} operation - Название операции
     */
    resetOperation(operation) {
      this.requestHistory.delete(operation);
      if (this.stats.operationStats[operation]) {
        delete this.stats.operationStats[operation];
      }
      console.log(`[Rate Limiter] Reset operation: ${operation}`);
    }

    /**
     * Получить список всех отслеживаемых операций
     * @returns {Array<string>}
     */
    getOperations() {
      return Object.keys(this.limits);
    }

    /**
     * Проверить доступен ли запас для операции (не блокирует)
     * @param {string} operation
     * @returns {boolean}
     */
    hasCapacity(operation) {
      const limit = this.limits[operation];
      if (!limit) return true;

      const now = Date.now();
      const history = this.requestHistory.get(operation) || [];
      const activeRequests = history.filter(
        timestamp => now - timestamp < limit.windowMs
      );

      return activeRequests.length < limit.maxRequests;
    }
  }

  // Создаем глобальный экземпляр
  window.advancedRateLimiter = new AdvancedRateLimiter();

  // Expose class для тестирования
  window.AdvancedRateLimiter = AdvancedRateLimiter;

  console.log('✅ [Rate Limiter] Advanced Rate Limiter initialized with',
    Object.keys(window.advancedRateLimiter.limits).length, 'operation types');

  // Debug helper в dev mode
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.rateLimiterDebug = {
      stats: () => console.table(window.advancedRateLimiter.getStats()),
      reset: () => window.advancedRateLimiter.reset(),
      check: (op) => console.log(window.advancedRateLimiter.checkLimit(op))
    };
    console.log('💡 [Rate Limiter] Debug helpers available: window.rateLimiterDebug');
  }

})();
