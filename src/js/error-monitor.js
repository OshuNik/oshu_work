// error-monitor.js — система мониторинга ошибок для отправки в Telegram бот

(function() {
  'use strict';

  class ErrorMonitor {
    constructor(config = {}) {
      this.config = {
        botToken: config.botToken || window.APP_CONFIG?.ERROR_BOT_TOKEN,
        chatId: config.chatId || window.APP_CONFIG?.ERROR_CHAT_ID,
        enabled: config.enabled ?? window.APP_CONFIG?.ERROR_MONITOR_ENABLED ?? false,
        maxErrors: config.maxErrors || 10, // максимум ошибок в час
        throttleMs: config.throttleMs || 300000, // 5 минут между похожими ошибками
        environment: config.environment || (window.location.hostname === 'localhost' ? 'development' : 'production'),
        appName: config.appName || 'oshu://work',
        version: config.version || '15.1'
      };

      this.errorQueue = [];
      this.sentErrors = new Map(); // для throttling
      this.hourlyCount = 0;
      this.lastHourReset = Date.now();

      this.init();
    }

    init() {
      if (!this.config.enabled) {
        console.log('📊 Error Monitor: disabled');
        return;
      }

      if (!this.config.botToken || !this.config.chatId) {
        console.warn('📊 Error Monitor: missing bot token or chat ID');
        return;
      }

      // Глобальные обработчики ошибок
      window.addEventListener('error', this.handleError.bind(this));
      window.addEventListener('unhandledrejection', this.handleRejection.bind(this));

      // Переопределяем console.error для перехвата
      this.overrideConsoleError();

      console.log('📊 Error Monitor: initialized for', this.config.environment);
    }

    handleError(event) {
      const error = {
        type: 'JavaScript Error',
        message: event.message || 'Unknown error',
        filename: event.filename || 'unknown',
        lineno: event.lineno || 0,
        colno: event.colno || 0,
        stack: event.error?.stack || 'No stack trace',
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      };

      this.reportError(error);
    }

    handleRejection(event) {
      const error = {
        type: 'Unhandled Promise Rejection',
        message: event.reason?.message || String(event.reason) || 'Promise rejected',
        stack: event.reason?.stack || 'No stack trace',
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      };

      this.reportError(error);
    }

    overrideConsoleError() {
      const originalError = console.error.bind(console);
      
      console.error = (...args) => {
        // Всегда вызываем оригинальный console.error
        originalError(...args);

        // Формируем ошибку для отправки
        const errorMsg = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');

        const error = {
          type: 'Console Error',
          message: errorMsg,
          stack: (new Error()).stack || 'No stack trace',
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent
        };

        this.reportError(error);
      };
    }

    reportError(error) {
      try {
        // Проверяем лимиты
        if (!this.shouldReport(error)) {
          return;
        }

        // Обогащаем контекстом
        const enrichedError = this.enrichError(error);

        // Добавляем в очередь
        this.errorQueue.push(enrichedError);

        // Отправляем
        this.sendError(enrichedError);

      } catch (e) {
        console.warn('Error Monitor: failed to report error', e);
      }
    }

    shouldReport(error) {
      // Проверяем hourly limit
      const now = Date.now();
      if (now - this.lastHourReset > 3600000) { // 1 час
        this.hourlyCount = 0;
        this.lastHourReset = now;
      }

      if (this.hourlyCount >= this.config.maxErrors) {
        return false;
      }

      // Проверяем throttling (одинаковые ошибки)
      const errorKey = `${error.type}:${error.message}:${error.filename}:${error.lineno}`;
      const lastSent = this.sentErrors.get(errorKey);
      
      if (lastSent && now - lastSent < this.config.throttleMs) {
        return false;
      }

      // Игнорируем некоторые ошибки браузера
      if (this.shouldIgnoreError(error)) {
        return false;
      }

      this.sentErrors.set(errorKey, now);
      this.hourlyCount++;
      return true;
    }

    shouldIgnoreError(error) {
      const message = error.message.toLowerCase();
      
      // Игнорируем extension ошибки
      if (message.includes('chrome-extension') || 
          message.includes('moz-extension') ||
          message.includes('safari-extension')) {
        return true;
      }

      // Игнорируем network timeouts в dev режиме
      if (this.config.environment === 'development' && 
          (message.includes('fetch') || message.includes('network'))) {
        return true;
      }

      // Игнорируем ResizeObserver ошибки (не критичные)
      if (message.includes('resizeobserver')) {
        return true;
      }

      return false;
    }

    enrichError(error) {
      const enriched = { ...error };

      // Добавляем информацию о приложении
      enriched.app = {
        name: this.config.appName,
        version: this.config.version,
        environment: this.config.environment
      };

      // Добавляем информацию о пользователе (без PII)
      enriched.context = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        referrer: document.referrer,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        screen: `${window.screen.width}x${window.screen.height}`,
        online: navigator.onLine,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled
      };

      // Telegram WebApp контекст если доступен
      if (window.Telegram?.WebApp) {
        enriched.telegram = {
          platform: window.Telegram.WebApp.platform,
          version: window.Telegram.WebApp.version,
          themeParams: window.Telegram.WebApp.themeParams,
          isExpanded: window.Telegram.WebApp.isExpanded
        };
      }

      // Добавляем состояние localStorage (без sensitive данных)
      try {
        const safeLocalStorage = {};
        for (let key in localStorage) {
          if (!key.includes('token') && !key.includes('key') && !key.includes('auth')) {
            const value = localStorage.getItem(key);
            if (value && value.length < 100) {
              safeLocalStorage[key] = value;
            }
          }
        }
        enriched.localStorage = safeLocalStorage;
      } catch (e) {
        enriched.localStorage = { error: 'Cannot access localStorage' };
      }

      return enriched;
    }

    async sendError(error) {
      try {
        const message = this.formatTelegramMessage(error);
        
        const response = await fetch(`https://api.telegram.org/bot${this.config.botToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chat_id: this.config.chatId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true
          })
        });

        if (!response.ok) {
          console.warn('Error Monitor: failed to send to Telegram', response.status);
        }

      } catch (e) {
        console.warn('Error Monitor: network error sending to Telegram', e);
      }
    }

    formatTelegramMessage(error) {
      const analysis = this.analyzeError(error);
      const env = error.app.environment === 'production' ? '🌐 САЙТ' : '💻 ТЕСТ';
      
      // ЗАГОЛОВОК - компактно в одну строку
      let message = `${analysis.priorityEmoji} <b>${error.app.name}</b> ${env} ${analysis.urgencyBadge} ${analysis.categoryBadge}\n\n`;
      
      // БЛОК 1: ОСНОВНАЯ ИНФОРМАЦИЯ
      message += `📋 <b>ОШИБКА</b>\n`;
      message += `${error.type}: <code>${this.escapeHtml(error.message)}</code>\n`;
      
      if (error.filename && error.filename !== 'unknown') {
        message += `📍 ${error.filename}:${error.lineno}:${error.colno}\n`;
      }
      message += `🕐 ${new Date(error.timestamp).toLocaleString('ru')}\n\n`;
      
      // БЛОК 2: АНАЛИЗ - сокращенно
      message += `🎯 <b>АНАЛИЗ</b>\n`;
      message += `Приоритет: <b>${analysis.priority}</b> | Влияние: ${analysis.impact}\n\n`;
      
      // БЛОК 3: ДЕЙСТВИЯ - только важные
      if (analysis.quickActions.length > 0) {
        message += `⚡ <b>ДЕЙСТВИЯ</b>\n`;
        analysis.quickActions.slice(0, 2).forEach((action, i) => {
          message += `${i + 1}. ${action}\n`;
        });
        message += '\n';
      } else if (analysis.recommendations.length > 0) {
        message += `💡 <b>РЕКОМЕНДАЦИИ</b>\n`;
        analysis.recommendations.slice(0, 2).forEach((rec, i) => {
          message += `${i + 1}. ${rec}\n`;
        });
        message += '\n';
      }
      
      // БЛОК 4: ТЕХНИЧЕСКАЯ ИНФОРМАЦИЯ - кратко
      message += `🔧 <b>КОНТЕКСТ</b>\n`;
      if (error.telegram) {
        message += `Telegram ${error.telegram.platform} | `;
      }
      message += `${error.context.platform}\n`;
      message += `Экран: ${error.context.viewport} | <a href="${error.context.url}">Открыть страницу</a>\n\n`;
      
      // БЛОК 5: STACK TRACE - только для критичных ошибок
      if (error.stack && analysis.priority === 'КРИТИЧЕСКИЙ') {
        const stackLines = error.stack.split('\n').slice(0, 3);
        message += `📍 <b>STACK</b>\n<pre>${this.escapeHtml(stackLines.join('\n'))}</pre>\n`;
      }

      // КРИТИЧЕСКОЕ ПРЕДУПРЕЖДЕНИЕ
      if (analysis.priority === 'КРИТИЧЕСКИЙ') {
        message += `\n🚨 <b>ТРЕБУЕТ НЕМЕДЛЕННОГО ВНИМАНИЯ!</b>`;
      }

      // Обрезаем сообщение если слишком длинное (Telegram limit 4096)
      if (message.length > 4000) {
        message = message.substring(0, 3900) + '\n\n...[обрезано]';
      }

      return message;
    }

    analyzeError(error) {
      const message = error.message.toLowerCase();
      const type = error.type;
      const url = error.context?.url || '';
      const stack = error.stack || '';
      
      // Определение категории и приоритета
      let priority = 'СРЕДНИЙ';
      let urgency = 'ОБЫЧНАЯ';
      let impact = 'Локальная проблема';
      let frequency = 'Единичный случай';
      let category = 'Общая ошибка';
      let recommendations = [];
      let quickActions = [];

      // Анализ критичных ошибок
      if (this.isCriticalNetworkError(message, type)) {
        priority = 'КРИТИЧЕСКИЙ';
        urgency = 'СРОЧНО';
        impact = 'Блокирует всех пользователей';
        category = 'Сетевая ошибка';
        recommendations = [
          'Проверить статус Supabase сервера',
          'Убедиться что API endpoints доступны',
          'Проверить интернет соединение сервера'
        ];
        quickActions = [
          'Открыть Supabase Dashboard',
          'Проверить логи сервера',
          'Уведомить пользователей о проблеме'
        ];
      }
      else if (this.isChunkLoadError(message)) {
        priority = 'ВЫСОКИЙ';
        urgency = 'СРОЧНО';
        impact = 'Приложение не загружается у пользователей';
        category = 'Проблема загрузки';
        recommendations = [
          'Пересобрать и задеплоить приложение',
          'Проверить кэширование CDN/GitHub Pages',
          'Очистить кэш браузера пользователей'
        ];
        quickActions = [
          'Запустить npm run build && git push',
          'Проверить GitHub Pages статус',
          'Отправить инструкции по очистке кэша'
        ];
      }
      else if (this.isAuthError(message)) {
        priority = 'ВЫСОКИЙ';
        urgency = 'СРОЧНО';
        impact = 'Пользователи не могут авторизоваться';
        category = 'Авторизация';
        recommendations = [
          'Проверить Supabase Auth настройки',
          'Убедиться что API ключи действительны',
          'Проверить RLS политики'
        ];
        quickActions = [
          'Проверить Supabase Auth логи',
          'Обновить API ключи если нужно'
        ];
      }
      else if (this.isUIError(message, type)) {
        priority = 'СРЕДНИЙ';
        urgency = 'ОБЫЧНАЯ';
        impact = 'Проблемы с интерфейсом';
        category = 'UI ошибка';
        recommendations = [
          'Проверить совместимость с браузером пользователя',
          'Проверить CSS и JavaScript загрузку',
          'Проверить работу на мобильных устройствах'
        ];
        quickActions = [
          'Протестировать на разных браузерах',
          'Проверить responsive design'
        ];
      }
      else if (this.isStorageError(message)) {
        priority = 'НИЗКИЙ';
        urgency = 'НЕ СРОЧНО';
        impact = 'Настройки пользователя не сохраняются';
        category = 'LocalStorage';
        recommendations = [
          'Проверить квоту localStorage',
          'Реализовать fallback для приватного режима',
          'Уведомить пользователя о проблеме'
        ];
        quickActions = [
          'Добавить try/catch для localStorage операций'
        ];
      }
      else if (type === 'Console Error') {
        priority = 'НИЗКИЙ';
        urgency = 'НЕ СРОЧНО';
        impact = 'Отладочная информация';
        category = 'Debug';
        recommendations = [
          'Проанализировать логику в указанном месте',
          'Проверить входные данные',
          'Добавить дополнительную валидацию'
        ];
      }

      // Определение частоты на основе времени
      if (this.sentErrors.size > 5) {
        frequency = 'Частые ошибки';
        if (priority === 'СРЕДНИЙ') priority = 'ВЫСОКИЙ';
      }

      // Эмодзи и бейджи
      const priorityEmoji = this.getPriorityEmoji(priority);
      const urgencyBadge = this.getUrgencyBadge(urgency);
      const categoryBadge = this.getCategoryBadge(category);

      return {
        priority,
        urgency,
        impact,
        frequency,
        category,
        recommendations,
        quickActions,
        priorityEmoji,
        urgencyBadge,
        categoryBadge
      };
    }

    isCriticalNetworkError(message, type) {
      const networkPatterns = [
        'failed to fetch',
        'network error',
        'connection refused',
        'supabase',
        'timeout',
        'offline'
      ];
      return type.includes('Network') || networkPatterns.some(pattern => message.includes(pattern));
    }

    isChunkLoadError(message) {
      return message.includes('chunk') && (message.includes('load') || message.includes('import'));
    }

    isAuthError(message) {
      const authPatterns = ['auth', 'unauthorized', '401', '403', 'permission', 'token'];
      return authPatterns.some(pattern => message.includes(pattern));
    }

    isUIError(message, type) {
      const uiPatterns = ['element', 'dom', 'render', 'component', 'null', 'undefined'];
      return type === 'JavaScript Error' && uiPatterns.some(pattern => message.includes(pattern));
    }

    isStorageError(message) {
      const storagePatterns = ['localstorage', 'storage', 'quota', 'exceeded'];
      return storagePatterns.some(pattern => message.includes(pattern));
    }

    getPriorityEmoji(priority) {
      switch (priority) {
        case 'КРИТИЧЕСКИЙ': return '🔥';
        case 'ВЫСОКИЙ': return '🚨';
        case 'СРЕДНИЙ': return '⚠️';
        case 'НИЗКИЙ': return 'ℹ️';
        default: return '❓';
      }
    }

    getUrgencyBadge(urgency) {
      switch (urgency) {
        case 'СРОЧНО': return '🔴 СРОЧНО';
        case 'ОБЫЧНАЯ': return '🟡 ОБЫЧНАЯ';
        case 'НЕ СРОЧНО': return '🟢 НЕ СРОЧНО';
        default: return '⚪ НЕОПРЕДЕЛЕНО';
      }
    }

    getCategoryBadge(category) {
      const badges = {
        'Сетевая ошибка': '🌐 ИНТЕРНЕТ',
        'Проблема загрузки': '📦 ЗАГРУЗКА',
        'Авторизация': '🔐 ВХОД',
        'UI ошибка': '🎨 ДИЗАЙН',
        'LocalStorage': '💾 ПАМЯТЬ',
        'Debug': '🔍 ОТЛАДКА',
        'Общая ошибка': '⚠️ ОШИБКА'
      };
      return badges[category] || '❓ НЕИЗВЕСТНО';
    }

    getErrorEmoji(type) {
      switch (type) {
        case 'JavaScript Error': return '💥';
        case 'Unhandled Promise Rejection': return '🚨';
        case 'Console Error': return '⚠️';
        case 'Network Error': return '🌐';
        default: return '❌';
      }
    }

    escapeHtml(text) {
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    }

    // Публичные методы для ручной отправки ошибок
    reportCustomError(message, context = {}) {
      const error = {
        type: 'Custom Error',
        message: message,
        stack: (new Error()).stack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        customContext: context
      };

      this.reportError(error);
    }

    // Получить статистику
    getStats() {
      return {
        queueSize: this.errorQueue.length,
        hourlyCount: this.hourlyCount,
        throttledErrors: this.sentErrors.size,
        config: { ...this.config, botToken: '[hidden]' }
      };
    }

    // Включить/выключить мониторинг
    setEnabled(enabled) {
      this.config.enabled = enabled;
      console.log(`📊 Error Monitor: ${enabled ? 'enabled' : 'disabled'}`);
    }

    // Тестовые функции для проверки системы
    test() {
      console.log('🧪 Testing Error Monitor...');
      
      // Тест 1: JavaScript ошибка
      setTimeout(() => {
        console.log('🧪 Test 1: Sending JavaScript error...');
        this.reportCustomError('Test JavaScript Error', {
          test: 'manual_test_js_error',
          timestamp: Date.now()
        });
      }, 1000);
      
      // Тест 2: Network ошибка
      setTimeout(() => {
        console.log('🧪 Test 2: Sending Network error...');
        this.reportCustomError('Test Network Error', {
          test: 'manual_test_network_error',
          url: 'https://test.example.com/api/test',
          status: 500
        });
      }, 2000);
      
      console.log('🧪 Tests scheduled. Check your Telegram bot for messages.');
      return this.getStats();
    }
  }

  // Создаем глобальный экземпляр
  window.errorMonitor = new ErrorMonitor();

  // Экспортируем для модулей
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorMonitor;
  }

})();