// api-service.js — сервис для работы с API

(function () {
  'use strict';

  const CFG = window.APP_CONFIG || {};
  const CONST = window.APP_CONSTANTS || {};
  const UTIL = window.utils || {};

  class ApiService {
    constructor() {
      this.baseUrl = CFG.SUPABASE_URL;
      this.anonKey = CFG.SUPABASE_ANON_KEY;
      this.retryOptions = CFG.RETRY_OPTIONS || {};
    }

    // Создать заголовки для запросов
    createHeaders(options = {}) {
      const headers = {
        'apikey': this.anonKey,
        'Authorization': `Bearer ${this.anonKey}`,
        'Content-Type': 'application/json',
        // ✅ SECURITY FIX: CSRF Protection - указываем что запрос идет из нашего приложения
        'X-Requested-With': 'XMLHttpRequest',
      };

      if (options.prefer) {
        headers['Prefer'] = options.prefer;
      }

      return headers;
    }

    // Построить URL для категории вакансий
    buildCategoryUrl(key, limit, offset, query) {
      const params = new URLSearchParams();
      params.set('select', '*');
      params.set('status', `eq.${CFG.STATUSES?.NEW || 'NEW'}`);
      params.set('order', 'timestamp.desc');
      params.set('limit', String(limit));
      params.set('offset', String(offset));

      // Установка категории
      if (key === 'main') {
        params.set('category', `eq.${CFG.CATEGORIES?.MAIN || 'ТОЧНО ТВОЁ'}`);
      } else if (key === 'maybe') {
        params.set('category', `eq.${CFG.CATEGORIES?.MAYBE || 'МОЖЕТ БЫТЬ'}`);
      } else {
        params.set('category', `not.in.("${CFG.CATEGORIES?.MAIN || 'ТОЧНО ТВОЁ'}","${CFG.CATEGORIES?.MAYBE || 'МОЖЕТ БЫТЬ'}")`);
      }

      // Добавление поискового запроса
      const trimmedQuery = (query || '').trim();
      if (trimmedQuery && Array.isArray(CFG.SEARCH_FIELDS) && CFG.SEARCH_FIELDS.length) {
        const orExpr = '(' + CFG.SEARCH_FIELDS.map(field => `${field}.ilike.*${trimmedQuery}*`).join(',') + ')';
        params.set('or', orExpr);
      }

      return `${this.baseUrl}/rest/v1/vacancies?${params.toString()}`;
    }

    // Построить URL для подсчета вакансий
    buildCountUrl(key, query) {
      const params = new URLSearchParams();
      params.set('select', 'id');
      params.set('status', `eq.${CFG.STATUSES?.NEW || 'NEW'}`);
      params.set('limit', '1');
      
      // Установка категории
      if (key === 'main') {
        params.set('category', `eq.${CFG.CATEGORIES?.MAIN || 'ТОЧНО ТВОЁ'}`);
      } else if (key === 'maybe') {
        params.set('category', `eq.${CFG.CATEGORIES?.MAYBE || 'МОЖЕТ БЫТЬ'}`);
      } else {
        params.set('category', `not.in.("${CFG.CATEGORIES?.MAIN || 'ТОЧНО ТВОЁ'}","${CFG.CATEGORIES?.MAYBE || 'МОЖЕТ БЫТЬ'}")`);
      }

      // Добавление поискового запроса
      const trimmedQuery = (query || '').trim();
      if (trimmedQuery && Array.isArray(CFG.SEARCH_FIELDS) && CFG.SEARCH_FIELDS.length) {
        const orExpr = '(' + CFG.SEARCH_FIELDS.map(field => `${field}.ilike.*${trimmedQuery}*`).join(',') + ')';
        params.set('or', orExpr);
      }

      return `${this.baseUrl}/rest/v1/vacancies?${params.toString()}`;
    }

    // Загрузить вакансии для категории
    async fetchVacancies(key, limit, offset, query, signal) {
      // ✅ SECURITY FIX: Rate limit check
      const rateLimitResult = window.advancedRateLimiter?.checkLimit('fetchVacancies');
      if (rateLimitResult && !rateLimitResult.allowed) {
        return {
          success: false,
          error: rateLimitResult.message,
          severity: 'warning',
          isRetryable: true
        };
      }

      const url = this.buildCategoryUrl(key, limit, offset, query);
      const headers = this.createHeaders({ prefer: 'count=exact' });

      try {
        const response = await UTIL.fetchWithRetry(url, {
          headers,
          signal
        }, this.retryOptions);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Безопасное получение total с проверкой существования функции
        let total = 0;
        if (UTIL && typeof UTIL.parseTotal === 'function') {
          total = UTIL.parseTotal(response) || 0;
        }

        return {
          success: true,
          data,
          total: Number.isFinite(total) ? total : 0
        };
      } catch (error) {
        if (error.name === 'AbortError') {
          return { success: false, aborted: true };
        }
        
        return this.handleError(error, true);
      }
    }

    // Загрузить счетчики для всех категорий
    async fetchCountsAll(query) {
      const categories = ['main', 'maybe', 'other'];
      const results = {};

      try {
        const promises = categories.map(async (key) => {
          const url = this.buildCountUrl(key, query);
          const headers = this.createHeaders({ prefer: 'count=exact' });
          
          // Увеличиваем таймаут для мобильных устройств
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), CONST?.TIMEOUTS?.MOBILE || 15000);
          
          try {
            const response = await UTIL.fetchWithRetry(url, {
              headers,
              signal: controller.signal
            }, this.retryOptions);
            
            if (!response.ok) {
              throw new Error('count failed');
            }

            // Безопасное получение count с проверкой
            let count = 0;
            if (UTIL && typeof UTIL.parseTotal === 'function') {
              count = UTIL.parseTotal(response) || 0;
            }

            return { key, count: Number.isFinite(count) ? count : 0 };
          } finally {
            clearTimeout(timeoutId);
          }
        });

        const countResults = await Promise.allSettled(promises);
        
        countResults.forEach((result, index) => {
          const key = categories[index];
          if (result.status === 'fulfilled') {
            results[key] = result.value.count;
          } else {
            console.warn(`Не удалось загрузить счетчик для ${key}:`, result.reason);
            results[key] = 0;
          }
        });

        return { success: true, counts: results };
      } catch (error) {
        const result = this.handleError(error, false); // Не показывать toast для счетчиков
        return {
          ...result,
          counts: { main: 0, maybe: 0, other: 0 }
        };
      }
    }

    // Обновить статус вакансии
    async updateVacancyStatus(vacancyId, newStatus, signal) {
      // ✅ SECURITY FIX: Validate mutation request origin
      if (!this.validateMutationRequest()) {
        return {
          success: false,
          error: 'Невозможно выполнить операцию: нарушение CSRF безопасности',
          isRetryable: false
        };
      }

      const url = `${this.baseUrl}/rest/v1/vacancies?id=eq.${vacancyId}`;
      const headers = this.createHeaders();

      try {
        const response = await fetch(url, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: newStatus }),
          signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return { success: true };
      } catch (error) {
        if (error.name === 'AbortError') {
          return { success: false, aborted: true };
        }
        
        return this.handleError(error, true);
      }
    }

    // Удалить вакансию
    async deleteVacancy(vacancyId, signal) {
      // ✅ SECURITY FIX: Validate mutation request origin
      if (!this.validateMutationRequest()) {
        return {
          success: false,
          error: 'Невозможно выполнить операцию: нарушение CSRF безопасности',
          isRetryable: false
        };
      }

      const url = `${this.baseUrl}/rest/v1/vacancies?id=eq.${vacancyId}`;
      const headers = this.createHeaders();

      try {
        const response = await fetch(url, {
          method: 'DELETE',
          headers,
          signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return { success: true };
      } catch (error) {
        if (error.name === 'AbortError') {
          return { success: false, aborted: true };
        }
        
        return this.handleError(error, true);
      }
    }

    // Обработать ошибки API с пользовательским интерфейсом
    handleError(error, showToUser = true) {
      let userMessage = 'Произошла ошибка при загрузке данных';
      let isRetryable = false;
      let severity = 'error';
      
      // Анализ типа ошибки
      if (error.name === 'TypeError' || error.message?.includes('NetworkError') || error.message?.includes('Failed to fetch')) {
        userMessage = 'Проблема с подключением к интернету';
        isRetryable = true;
        severity = 'warning';
      } else if (error.name === 'AbortError') {
        userMessage = 'Запрос был отменен';
        isRetryable = false;
        severity = 'info';
      } else if (error.status === 401) {
        userMessage = 'Проблема с авторизацией. Перезагрузите страницу';
        isRetryable = false;
      } else if (error.status === 403) {
        userMessage = 'Доступ запрещен';
        isRetryable = false;
      } else if (error.status === 404) {
        userMessage = 'Данные не найдены';
        isRetryable = false;
      } else if (error.status === 429) {
        userMessage = 'Слишком много запросов. Попробуйте через минуту';
        isRetryable = true;
        severity = 'warning';
      } else if (error.status >= 500) {
        userMessage = 'Временные проблемы сервера. Попробуйте позже';
        isRetryable = true;
        severity = 'warning';
      } else if (error.status >= 400 && error.status < 500) {
        userMessage = 'Ошибка в запросе. Обновите страницу';
        isRetryable = false;
      }

      // Логирование с дополнительной информацией
      console.error('API Error:', {
        message: error.message,
        status: error.status,
        stack: error.stack,
        isRetryable,
        severity,
        timestamp: new Date().toISOString()
      });
      
      if (showToUser && UTIL.uiToast) {
        UTIL.uiToast(userMessage, {
          timeout: isRetryable ? 5000 : 3000
        });
      }
      
      return { 
        success: false, 
        error: userMessage,
        isRetryable,
        severity,
        originalError: error
      };
    }

    // Проверить статус сети
    checkNetworkStatus() {
      return navigator.onLine;
    }

    // Обработать offline состояние
    handleOfflineMode() {
      const isOnline = this.checkNetworkStatus();
      
      if (!isOnline) {
        if (UTIL.uiToast) {
          UTIL.uiToast('Нет подключения к интернету', {
            timeout: 0 // Не скрывать автоматически
          });
        }
        return false;
      }
      return true;
    }

    // Проверить доступность API
    async healthCheck() {
      try {
        const response = await fetch(`${this.baseUrl}/rest/v1/vacancies?select=id&limit=1`, {
          headers: this.createHeaders(),
          signal: AbortSignal.timeout(5000) // 5 секунд таймаут
        });

        return {
          success: response.ok,
          status: response.status,
          available: response.ok
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          available: false
        };
      }
    }

    // ✅ SECURITY FIX: Validate that mutation requests come from the app context
    validateMutationRequest() {
      // Проверяем что мы в HTTPS (критично для безопасности)
      if (typeof window !== 'undefined' && window.location && window.location.protocol !== 'https:' && !this.isDevelopmentEnv()) {
        console.warn('⚠️ CSRF validation: HTTPS required for mutations');
        return false;
      }

      // Проверяем что приложение инициализировано (базовая проверка что мы в контексте приложения)
      if (!window.stateManager || !window.vacancyManager) {
        console.warn('⚠️ CSRF validation: App not properly initialized');
        return false;
      }

      return true;
    }

    // Проверить окружение (для локальной разработки)
    isDevelopmentEnv() {
      return window.location.hostname === 'localhost' ||
             window.location.hostname === '127.0.0.1' ||
             window.location.hostname.startsWith('192.168.');
    }
  }

  // Создаем глобальный экземпляр API сервиса
  window.apiService = new ApiService();

})();
