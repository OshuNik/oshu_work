// debug-logger.js — умный логгер с поддержкой Telegram мониторинга
// Сохраняет error/warn для мониторинг бота, убирает debug логи в production

(function() {
  'use strict';

  // Получаем конфигурацию окружения
  const CFG = window.APP_CONFIG || {};
  const isDev = CFG.NODE_ENV === 'development' || CFG.DEBUG || false;
  const isProd = CFG.NODE_ENV === 'production';

  // Создаем умный логгер
  const logger = {
    // ВСЕГДА логируем ошибки - они нужны для мониторинг бота
    error: function(...args) {
      console.error(...args);
      
      // Интеграция с существующим error-monitor
      if (window.errorMonitor && typeof window.errorMonitor.sendError === 'function') {
        try {
          const errorMessage = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ');
          
          const errorObj = {
            type: 'Debug Logger Error',
            message: errorMessage,
            timestamp: new Date().toISOString(),
            source: 'debug-logger.js',
            stack: (new Error()).stack
          };
          
          window.errorMonitor.sendError(errorObj);
        } catch (e) {
          console.warn('Debug Logger: Failed to send error to monitor:', e);
        }
      }
      
      // Fallback для старой интеграции
      if (window.telegramMonitoring && typeof window.telegramMonitoring.sendError === 'function') {
        try {
          const errorMessage = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          ).join(' ');
          window.telegramMonitoring.sendError(errorMessage);
        } catch (e) {
          // Если мониторинг не работает, просто продолжаем
        }
      }
    },

    // ВСЕГДА логируем предупреждения - они важны для диагностики
    warn: function(...args) {
      console.warn(...args);
      
      // Интеграция с существующим error-monitor (warnings тоже отправляем как errors)
      if (window.errorMonitor && typeof window.errorMonitor.sendError === 'function') {
        try {
          const warnMessage = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ');
          
          const errorObj = {
            type: 'Debug Logger Warning',
            message: `⚠️ WARNING: ${warnMessage}`,
            timestamp: new Date().toISOString(),
            source: 'debug-logger.js',
            stack: (new Error()).stack
          };
          
          window.errorMonitor.sendError(errorObj);
        } catch (e) {
          console.warn('Debug Logger: Failed to send warning to monitor:', e);
        }
      }
      
      // Fallback для старой интеграции
      if (window.telegramMonitoring && typeof window.telegramMonitoring.sendWarning === 'function') {
        try {
          const warnMessage = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          ).join(' ');
          window.telegramMonitoring.sendWarning(warnMessage);
        } catch (e) {
          // Если мониторинг не работает, просто продолжаем
        }
      }
    },

    // INFO логи только в development
    info: isDev ? console.info.bind(console) : function() {},
    
    // DEBUG логи только в development
    log: isDev ? console.log.bind(console) : function() {},
    debug: isDev ? console.debug.bind(console) : function() {},

    // TABLE для удобства разработки
    table: isDev ? console.table.bind(console) : function() {},

    // GROUP для структурированного вывода в dev
    group: isDev ? console.group.bind(console) : function() {},
    groupEnd: isDev ? console.groupEnd.bind(console) : function() {},
    groupCollapsed: isDev ? console.groupCollapsed.bind(console) : function() {},

    // ASSERT всегда работает (важно для проверки состояний)
    assert: console.assert.bind(console),

    // TIME/TIMEEND для профилирования только в dev
    time: isDev ? console.time.bind(console) : function() {},
    timeEnd: isDev ? console.timeEnd.bind(console) : function() {},

    // Специальные методы для разных контекстов
    api: {
      success: isDev ? (...args) => console.log('🟢 API Success:', ...args) : function() {},
      error: (...args) => logger.error('🔴 API Error:', ...args),
      request: isDev ? (...args) => console.log('🔄 API Request:', ...args) : function() {},
      response: isDev ? (...args) => console.log('📥 API Response:', ...args) : function() {},
    },

    ui: {
      action: isDev ? (...args) => console.log('👆 UI Action:', ...args) : function() {},
      error: (...args) => logger.error('🎨 UI Error:', ...args),
      render: isDev ? (...args) => console.log('🖼️ UI Render:', ...args) : function() {},
    },

    telegram: {
      event: isDev ? (...args) => console.log('📱 Telegram:', ...args) : function() {},
      error: (...args) => logger.error('📱 Telegram Error:', ...args),
      haptic: isDev ? (...args) => console.log('📳 Haptic:', ...args) : function() {},
    },

    // Утилита для условного логирования
    when: function(condition, level = 'log') {
      return condition ? logger[level] : function() {};
    },

    // Информация о текущем режиме
    getMode: function() {
      return {
        isDev,
        isProd,
        environment: CFG.NODE_ENV,
        debugEnabled: CFG.DEBUG,
        errorsAlwaysLogged: true,
        warningsAlwaysLogged: true
      };
    }
  };

  // Экспортируем глобально
  window.logger = logger;

  // Также создаем алиас для совместимости
  window.debugLogger = logger;

  // Логируем режим работы только в development
  if (isDev) {
    console.log('🐛 Debug Logger initialized:', logger.getMode());
  }

  // В production логируем только факт инициализации (без деталей)
  if (isProd) {
    console.info('Logger initialized - errors/warnings active');
  }

})();