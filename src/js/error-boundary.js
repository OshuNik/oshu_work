// error-boundary.js - Глобальный обработчик ошибок

(function() {
  'use strict';

  class ErrorBoundary {
    constructor() {
      this.errors = [];
      this.maxErrors = 100;
      this.errorCount = 0;
      this.lastErrorTime = 0;
      this.setupGlobalHandlers();
    }

    setupGlobalHandlers() {
      // Обработка синхронных ошибок
      window.addEventListener('error', (event) => {
        this.handleError(event.error, {
          type: 'error',
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });

        this.showUserError('Произошла ошибка. Попробуйте обновить страницу.');
        event.preventDefault();
      });

      // Обработка Promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.handleError(event.reason, {
          type: 'unhandledRejection',
          promise: 'Promise rejection'
        });

        this.showUserError('Ошибка при загрузке данных. Попробуйте обновить страницу.');
        event.preventDefault();
      });
    }

    handleError(error, context = {}) {
      this.errorCount++;
      const now = Date.now();

      // Rate limiting для ошибок (не спамить)
      if (now - this.lastErrorTime < 1000 && this.errorCount > 5) {
        console.warn('[ErrorBoundary] Too many errors, throttling...');
        return;
      }

      this.lastErrorTime = now;

      const errorInfo = {
        message: error?.message || String(error),
        stack: error?.stack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        context
      };

      this.errors.push(errorInfo);

      if (this.errors.length > this.maxErrors) {
        this.errors.shift();
      }

      console.error('[ErrorBoundary]', errorInfo);

      this.reportToMonitoring(errorInfo);
    }

    showUserError(message) {
      if (window.utils && window.utils.uiToast) {
        window.utils.uiToast(message, {
          timeout: 5000
        });
      }
    }

    reportToMonitoring(errorInfo) {
      if (window.errorMonitor && window.errorMonitor.captureException) {
        try {
          window.errorMonitor.captureException(errorInfo);
        } catch (e) {
          console.warn('[ErrorBoundary] Failed to report to monitoring:', e);
        }
      }
    }

    getErrors() {
      return this.errors;
    }

    clearErrors() {
      this.errors = [];
      this.errorCount = 0;
    }

    getStats() {
      return {
        totalErrors: this.errorCount,
        storedErrors: this.errors.length,
        lastErrorTime: this.lastErrorTime
      };
    }
  }

  window.errorBoundary = new ErrorBoundary();

  console.log('✅ [ErrorBoundary] Global error handler initialized');
})();
