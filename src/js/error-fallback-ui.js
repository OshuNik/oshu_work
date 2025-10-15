// error-fallback-ui.js - Fallback UI для критических ошибок

(function() {
  'use strict';

  class ErrorFallbackUI {
    constructor() {
      this.errorCount = 0;
      this.maxErrors = 3; // После 3 ошибок показываем fallback UI
      this.errorWindow = 5000; // Окно 5 секунд для подсчета ошибок
      this.errorTimestamps = [];
      this.init();
    }

    init() {
      // Подписываемся на глобальные ошибки
      window.addEventListener('error', this.handleError.bind(this));
      window.addEventListener('unhandledrejection', this.handleRejection.bind(this));

      console.log('✅ [Error Fallback] Error Fallback UI initialized');
    }

    handleError(event) {
      this.recordError();
      this.checkErrorThreshold();
    }

    handleRejection(event) {
      this.recordError();
      this.checkErrorThreshold();
    }

    recordError() {
      const now = Date.now();
      this.errorTimestamps.push(now);

      // Удаляем старые ошибки вне окна
      this.errorTimestamps = this.errorTimestamps.filter(
        timestamp => now - timestamp < this.errorWindow
      );
    }

    checkErrorThreshold() {
      if (this.errorTimestamps.length >= this.maxErrors) {
        this.showFallbackUI('Произошло несколько критических ошибок. Попробуйте перезагрузить страницу.');
      }
    }

    showFallbackUI(message) {
      // Проверяем что UI еще не показан
      if (document.getElementById('error-fallback-overlay')) {
        return;
      }

      // Создаем overlay с сообщением об ошибке
      const overlay = document.createElement('div');
      overlay.id = 'error-fallback-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        animation: fadeIn 0.3s ease-in-out;
      `;

      overlay.innerHTML = `
        <style>
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
          .error-icon {
            font-size: 64px;
            margin-bottom: 24px;
            animation: pulse 2s infinite;
          }
          .error-title {
            margin: 0 0 16px 0;
            font-size: 28px;
            font-weight: 600;
            text-align: center;
          }
          .error-message {
            margin: 0 0 32px 0;
            color: #ccc;
            font-size: 16px;
            text-align: center;
            max-width: 400px;
            line-height: 1.6;
          }
          .error-actions {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            justify-content: center;
          }
          .error-btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 14px 28px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
          }
          .error-btn:hover {
            background: #0056b3;
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0, 123, 255, 0.4);
          }
          .error-btn:active {
            transform: translateY(0);
          }
          .error-btn-secondary {
            background: #6c757d;
            box-shadow: 0 4px 12px rgba(108, 117, 125, 0.3);
          }
          .error-btn-secondary:hover {
            background: #545b62;
            box-shadow: 0 6px 16px rgba(108, 117, 125, 0.4);
          }
          .error-details {
            margin-top: 24px;
            padding: 16px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            max-width: 500px;
            font-size: 13px;
            color: #999;
            text-align: left;
          }
          .error-detail-item {
            margin: 8px 0;
            display: flex;
            justify-content: space-between;
            gap: 16px;
          }
          .error-detail-label {
            font-weight: 500;
            color: #ccc;
          }
        </style>
        <div style="text-align: center; padding: 32px; max-width: 600px;">
          <div class="error-icon">⚠️</div>
          <h2 class="error-title">Критическая ошибка</h2>
          <p class="error-message">${message}</p>
          <div class="error-actions">
            <button
              class="error-btn"
              onclick="window.location.reload()"
            >
              🔄 Перезагрузить страницу
            </button>
            <button
              class="error-btn error-btn-secondary"
              onclick="window.location.href = window.location.origin + window.location.pathname"
            >
              🏠 На главную
            </button>
          </div>
          <div class="error-details">
            <div class="error-detail-item">
              <span class="error-detail-label">Ошибок:</span>
              <span>${this.errorTimestamps.length}</span>
            </div>
            <div class="error-detail-item">
              <span class="error-detail-label">Время:</span>
              <span>${new Date().toLocaleTimeString('ru-RU')}</span>
            </div>
            <div class="error-detail-item">
              <span class="error-detail-label">Браузер:</span>
              <span>${this.getBrowserName()}</span>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      // Отправляем информацию об ошибке в error monitor
      if (window.errorMonitor) {
        window.errorMonitor.reportCustomError('Critical error threshold exceeded', {
          errorCount: this.errorTimestamps.length,
          message: message
        });
      }
    }

    getBrowserName() {
      const ua = navigator.userAgent;
      if (ua.includes('Firefox')) return 'Firefox';
      if (ua.includes('Chrome')) return 'Chrome';
      if (ua.includes('Safari')) return 'Safari';
      if (ua.includes('Edge')) return 'Edge';
      return 'Unknown';
    }

    reset() {
      this.errorTimestamps = [];
      const overlay = document.getElementById('error-fallback-overlay');
      if (overlay) {
        overlay.remove();
      }
    }

    getStats() {
      return {
        errorCount: this.errorTimestamps.length,
        maxErrors: this.maxErrors,
        errorWindow: this.errorWindow,
        recentErrors: this.errorTimestamps
      };
    }
  }

  // Создаем глобальный экземпляр
  window.errorFallbackUI = new ErrorFallbackUI();

  // Expose для тестирования
  window.ErrorFallbackUI = ErrorFallbackUI;

})();
