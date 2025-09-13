// error-helpers.js — утилиты для интеграции error monitor с существующим кодом

(function() {
  'use strict';

  // Проверяем доступность ErrorMonitor
  const getErrorMonitor = () => window.errorMonitor;

  /**
   * Wrapper для критичных операций с автоматической отправкой ошибок
   */
  window.withErrorReporting = async function(operation, context = {}) {
    try {
      const result = await operation();
      return result;
    } catch (error) {
      const monitor = getErrorMonitor();
      if (monitor) {
        monitor.reportCustomError(`Critical Operation Failed: ${error.message}`, {
          ...context,
          originalError: {
            message: error.message,
            stack: error.stack,
            name: error.name
          }
        });
      }
      
      // Пересылаем ошибку дальше
      throw error;
    }
  };

  /**
   * Wrapper для сетевых запросов
   */
  window.withNetworkErrorReporting = async function(fetchOperation, context = {}) {
    try {
      const response = await fetchOperation();
      
      // Проверяем статус ответа
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.response = response;
        throw error;
      }
      
      return response;
    } catch (error) {
      const monitor = getErrorMonitor();
      if (monitor) {
        const errorType = error.name === 'TypeError' ? 'Network Error' : 'API Error';
        monitor.reportCustomError(`${errorType}: ${error.message}`, {
          ...context,
          url: context.url || 'unknown',
          method: context.method || 'GET',
          status: error.status,
          errorDetails: {
            message: error.message,
            stack: error.stack,
            name: error.name
          }
        });
      }
      
      throw error;
    }
  };

  /**
   * Обработчик для Supabase ошибок
   */
  window.reportSupabaseError = function(error, operation = 'unknown', context = {}) {
    const monitor = getErrorMonitor();
    if (!monitor) return;

    monitor.reportCustomError(`Supabase ${operation} Error: ${error.message}`, {
      ...context,
      operation,
      supabaseError: {
        message: error.message,
        details: error.details || null,
        hint: error.hint || null,
        code: error.code || null
      }
    });
  };

  /**
   * Обработчик для WebSocket ошибок  
   */
  window.reportWebSocketError = function(error, event = 'unknown', context = {}) {
    const monitor = getErrorMonitor();
    if (!monitor) return;

    monitor.reportCustomError(`WebSocket ${event} Error: ${error.message || 'Connection issue'}`, {
      ...context,
      event,
      webSocketError: {
        message: error.message || 'WebSocket error',
        code: error.code || null,
        reason: error.reason || null,
        wasClean: error.wasClean || false
      }
    });
  };

  /**
   * Обработчик для localStorage ошибок
   */
  window.reportStorageError = function(error, operation = 'unknown', key = 'unknown') {
    const monitor = getErrorMonitor();
    if (!monitor) return;

    monitor.reportCustomError(`LocalStorage ${operation} Error: ${error.message}`, {
      operation,
      key,
      storageError: {
        message: error.message,
        name: error.name,
        quotaExceeded: error.name === 'QuotaExceededError'
      }
    });
  };

  /**
   * Safe localStorage wrapper с error reporting
   */
  window.safeLocalStorage = {
    getItem: function(key) {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        reportStorageError(error, 'getItem', key);
        return null;
      }
    },
    
    setItem: function(key, value) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (error) {
        reportStorageError(error, 'setItem', key);
        return false;
      }
    },
    
    removeItem: function(key) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        reportStorageError(error, 'removeItem', key);
        return false;
      }
    }
  };

  /**
   * Обработчик для UI критичных ошибок
   */
  window.reportUIError = function(error, component = 'unknown', context = {}) {
    const monitor = getErrorMonitor();
    if (!monitor) return;

    monitor.reportCustomError(`UI Component Error in ${component}: ${error.message}`, {
      ...context,
      component,
      uiError: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    });
  };

  /**
   * Wrapper для DOM операций
   */
  window.safeDOMOperation = function(operation, context = {}) {
    try {
      return operation();
    } catch (error) {
      reportUIError(error, 'DOM Operation', context);
      return null;
    }
  };

  /**
   * Проверка критичности ошибки
   */
  window.isCriticalError = function(error) {
    if (!error) return false;
    
    const criticalPatterns = [
      'chunk load error',
      'loading chunk',
      'failed to fetch',
      'network error',
      'script error',
      'reference error',
      'type error',
      'syntax error'
    ];
    
    const message = error.message?.toLowerCase() || '';
    return criticalPatterns.some(pattern => message.includes(pattern));
  };

  /**
   * Инициализация интеграции с существующими модулями
   */
  function initErrorIntegration() {
    const monitor = getErrorMonitor();
    if (!monitor) {
      console.warn('Error Monitor not available, error helpers are limited');
      return;
    }

    // Переопределяем fetch для автоматического reporting
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      try {
        const response = await originalFetch.apply(this, args);
        
        // Проверяем на критичные HTTP статусы
        if (!response.ok && response.status >= 500) {
          monitor.reportCustomError(`HTTP ${response.status} Error`, {
            url: args[0],
            method: args[1]?.method || 'GET',
            status: response.status,
            statusText: response.statusText
          });
        }
        
        return response;
      } catch (error) {
        // Сетевые ошибки
        monitor.reportCustomError(`Fetch Network Error: ${error.message}`, {
          url: args[0],
          method: args[1]?.method || 'GET',
          networkError: {
            message: error.message,
            stack: error.stack
          }
        });
        throw error;
      }
    };

    console.log('🔧 Error Helpers: integration initialized');
  }

  // Инициализируем при загрузке DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initErrorIntegration);
  } else {
    initErrorIntegration();
  }

})();