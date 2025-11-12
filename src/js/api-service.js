// api-service.js — сервис для работы с API

(function () {
  'use strict';

  const CFG = window.APP_CONFIG || {};
  const CONST = window.APP_CONSTANTS || {};
  const UTIL = window.utils || {};

  // ✅ FIX HIGH #8: Use centralized auth validation
  const AuthUtils = window.AuthUtils || {};

  class ApiService {
    constructor() {
      this.baseUrl = CFG.SUPABASE_URL;
      this.anonKey = CFG.SUPABASE_ANON_KEY;
      this.retryOptions = CFG.RETRY_OPTIONS || {};
      // ✅ FIX: DB query timeout
      this.DB_QUERY_TIMEOUT = 5000; // 5 seconds
      // ✅ FIX: Telegram API timeout
      this.TELEGRAM_TIMEOUT = 3000; // 3 seconds
    }

    /**
     * ✅ FIX: Create AbortSignal with timeout to prevent hanging requests
     * Prevents database queries and API calls from hanging indefinitely
     */
    createTimeoutSignal(timeoutMs) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        if (!controller.signal.aborted) {
          controller.abort();
        }
      }, timeoutMs);

      // Store timeout ID for cleanup if request completes before timeout
      controller.signal._timeoutId = timeoutId;
      return controller.signal;
    }

    /**
     * ✅ FIX: Merge two abort signals (user abort + timeout abort)
     */
    mergeSignals(userSignal, timeoutSignal) {
      if (!userSignal) return timeoutSignal;
      if (!timeoutSignal) return userSignal;

      const controller = new AbortController();

      const cleanup = () => {
        if (userSignal._timeoutId) clearTimeout(userSignal._timeoutId);
        if (timeoutSignal._timeoutId) clearTimeout(timeoutSignal._timeoutId);
      };

      userSignal.addEventListener('abort', () => {
        controller.abort();
        cleanup();
      });

      timeoutSignal.addEventListener('abort', () => {
        controller.abort();
        cleanup();
      });

      return controller.signal;
    }

    /**
     * ✅ SECURITY FIX: Escape special characters in filter values to prevent SQL injection
     * Escapes wildcards and special characters for safe use in ilike filters
     */
    escapeFilterValue(value) {
      if (typeof value !== 'string') {
        return '';
      }

      // ✅ FIX: Escape SQL LIKE special characters (% and _) and backslash
      // This prevents filter injection attacks through LIKE wildcards
      return value
        .replace(/\\/g, '\\\\')  // Escape backslash first (must be first)
        .replace(/%/g, '\\%')    // Escape percent (SQL LIKE wildcard)
        .replace(/_/g, '\\_');   // Escape underscore (SQL LIKE wildcard)
    }

    /**
     * ✅ SECURITY FIX: Validate and sanitize search query input
     */
    sanitizeSearchQuery(query) {
      if (!query || typeof query !== 'string') {
        return '';
      }

      // ✅ FIX: Normalize whitespace
      let sanitized = query.trim();

      // ✅ FIX: Remove null bytes and control characters
      sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, '');

      // ✅ FIX: Limit length to prevent extremely long queries
      const maxQueryLength = 256;
      if (sanitized.length > maxQueryLength) {
        sanitized = sanitized.substring(0, maxQueryLength);
      }

      // ✅ FIX: Only allow safe characters (alphanumeric, spaces, common punctuation)
      // This is an additional layer of protection
      sanitized = sanitized.replace(/[^\w\s\-\.@'\"]/gi, '');

      return sanitized;
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
      // ✅ FIX: Sanitize and escape user input before using in filters
      const trimmedQuery = this.sanitizeSearchQuery(query);
      if (trimmedQuery && Array.isArray(CFG.SEARCH_FIELDS) && CFG.SEARCH_FIELDS.length) {
        const escapedQuery = this.escapeFilterValue(trimmedQuery);
        const orExpr = '(' + CFG.SEARCH_FIELDS.map(field => `${field}.ilike.*${escapedQuery}*`).join(',') + ')';
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
      // ✅ FIX: Sanitize and escape user input before using in filters
      const trimmedQuery = this.sanitizeSearchQuery(query);
      if (trimmedQuery && Array.isArray(CFG.SEARCH_FIELDS) && CFG.SEARCH_FIELDS.length) {
        const escapedQuery = this.escapeFilterValue(trimmedQuery);
        const orExpr = '(' + CFG.SEARCH_FIELDS.map(field => `${field}.ilike.*${escapedQuery}*`).join(',') + ')';
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
        // ✅ FIX: Add timeout to DB queries to prevent hanging
        const timeoutSignal = this.createTimeoutSignal(this.DB_QUERY_TIMEOUT);
        const finalSignal = this.mergeSignals(signal, timeoutSignal);

        const response = await UTIL.fetchWithRetry(url, {
          headers,
          signal: finalSignal
        }, this.retryOptions);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // ✅ FIX: Безопасное получение total с проверкой существования функции и type coercion
        let total = 0;
        if (UTIL && typeof UTIL.parseTotal === 'function') {
          const parsedTotal = UTIL.parseTotal(response);
          // Проверяем что результат валидное число (не NaN, не Infinity)
          if (typeof parsedTotal === 'number' && Number.isFinite(parsedTotal) && parsedTotal >= 0) {
            total = parsedTotal;
          }
        }

        return {
          success: true,
          data,
          total: Number.isFinite(total) && total >= 0 ? total : 0
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

            // ✅ FIX: Безопасное получение count с проверкой type coercion
            let count = 0;
            if (UTIL && typeof UTIL.parseTotal === 'function') {
              const parsedCount = UTIL.parseTotal(response);
              // Проверяем что результат валидное число (не NaN, не Infinity)
              if (typeof parsedCount === 'number' && Number.isFinite(parsedCount) && parsedCount >= 0) {
                count = parsedCount;
              }
            }

            return { key, count: Number.isFinite(count) && count >= 0 ? count : 0 };
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

      // ✅ SECURITY FIX: Validate vacancy ID format (must be UUID or number)
      if (!this.isValidVacancyId(vacancyId)) {
        console.error('❌ Invalid vacancy ID format:', vacancyId);
        return {
          success: false,
          error: 'Invalid vacancy ID',
          isRetryable: false
        };
      }

      const url = `${this.baseUrl}/rest/v1/vacancies?id=eq.${vacancyId}`;
      const headers = this.createHeaders();

      try {
        // ✅ FIX: Add timeout to DB mutations to prevent hanging
        const timeoutSignal = this.createTimeoutSignal(this.DB_QUERY_TIMEOUT);
        const finalSignal = this.mergeSignals(signal, timeoutSignal);

        const response = await fetch(url, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: newStatus }),
          signal: finalSignal
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

      // ✅ SECURITY FIX: Validate vacancy ID format (must be UUID or number)
      if (!this.isValidVacancyId(vacancyId)) {
        console.error('❌ Invalid vacancy ID format:', vacancyId);
        return {
          success: false,
          error: 'Invalid vacancy ID',
          isRetryable: false
        };
      }

      const url = `${this.baseUrl}/rest/v1/vacancies?id=eq.${vacancyId}`;
      const headers = this.createHeaders();

      try {
        // ✅ FIX: Add timeout to DB mutations to prevent hanging
        const timeoutSignal = this.createTimeoutSignal(this.DB_QUERY_TIMEOUT);
        const finalSignal = this.mergeSignals(signal, timeoutSignal);

        const response = await fetch(url, {
          method: 'DELETE',
          headers,
          signal: finalSignal
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

    /**
     * ✅ SECURITY FIX: Validate vacancy ID format to prevent injection attacks
     */
    isValidVacancyId(vacancyId) {
      if (!vacancyId) {
        return false;
      }

      // Convert to string for validation
      const idStr = String(vacancyId);

      // ✅ FIX: Allow UUID format (8-4-4-4-12) or numeric IDs
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const numericPattern = /^\d+$/;

      return uuidPattern.test(idStr) || numericPattern.test(idStr);
    }

    // Обработать ошибки API с пользовательским интерфейсом
    handleError(error, showToUser = true) {
      let userMessage = 'Произошла ошибка при загрузке данных';
      let isRetryable = false;
      let severity = 'error';

      // ✅ FIX: Безопасный доступ к свойствам error с проверкой существования
      // Проверяем что error объект существует и имеет ожидаемые свойства
      if (!error || typeof error !== 'object') {
        console.error('Invalid error object:', error);
        return {
          success: false,
          error: userMessage,
          isRetryable: false,
          severity: 'error'
        };
      }

      const errorName = error.name || '';
      const errorMessage = error.message || '';
      const errorStatus = typeof error.status === 'number' ? error.status : null;

      // Анализ типа ошибки
      if (errorName === 'TypeError' || errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
        userMessage = 'Проблема с подключением к интернету';
        isRetryable = true;
        severity = 'warning';
      } else if (errorName === 'AbortError') {
        userMessage = 'Запрос был отменен';
        isRetryable = false;
        severity = 'info';
      } else if (errorStatus === 400) {
        // ✅ FIX HIGH #9: Specific handling for Bad Request
        userMessage = 'Неправильный формат запроса. Проверьте данные';
        isRetryable = false;
        severity = 'error';
      } else if (AuthUtils.isAuthErrorStatus && AuthUtils.isAuthErrorStatus(errorStatus)) {
        // ✅ FIX HIGH #8: Use centralized auth error handling
        const authError = AuthUtils.handleAuthError?.({ status: errorStatus }) || {};
        userMessage = authError.userMessage || (
          errorStatus === 401
            ? 'Проблема с авторизацией. Перезагрузите страницу'
            : 'Доступ запрещен'
        );
        isRetryable = false;
        severity = errorStatus === 401 ? 'error' : 'warning';
      } else if (errorStatus === 404) {
        // ✅ FIX HIGH #9: Specific handling for Not Found
        userMessage = 'Запрашиваемые данные не найдены';
        isRetryable = false;
        severity = 'warning';
      } else if (errorStatus === 429) {
        // ✅ FIX HIGH #9: Specific handling for Rate Limit
        userMessage = 'Слишком много запросов. Попробуйте через минуту';
        isRetryable = true;
        severity = 'warning';
      } else if (errorStatus === 503) {
        // ✅ FIX HIGH #9: Specific handling for Service Unavailable
        userMessage = 'Сервис временно недоступен. Пожалуйста, попробуйте позже';
        isRetryable = true;
        severity = 'warning';
      } else if (errorStatus !== null && errorStatus >= 500) {
        // ✅ FIX HIGH #9: Generic 5xx (excluding 503 which is handled above)
        userMessage = 'Ошибка сервера. Попробуйте позже';
        isRetryable = true;
        severity = 'warning';
      } else if (errorStatus !== null && errorStatus >= 400 && errorStatus < 500) {
        // ✅ FIX HIGH #9: Generic 4xx client errors
        userMessage = `Ошибка клиента (${errorStatus}). Обновите страницу`;
        isRetryable = false;
        severity = 'error';
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