// csp-manager.js — управление Content Security Policy

(function() {
  'use strict';

  class CSPManager {
    constructor() {
      this.nonce = this.generateNonce();
      this.violations = [];
      this.setupViolationReporting();
    }

    // Генерировать криптографически стойкий nonce
    generateNonce() {
      const array = new Uint8Array(16);
      if (window.crypto && window.crypto.getRandomValues) {
        try {
          window.crypto.getRandomValues(array);
        } catch (error) {
          console.warn('⚠️ CSP: Crypto API недоступен, используем fallback:', error.message);
          // Fallback для старых браузеров
          for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
          }
        }
      } else {
        console.warn('⚠️ CSP: Limited CSP support in this browser - crypto API недоступен');
        // Fallback для старых браузеров
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
      }
      return btoa(String.fromCharCode.apply(null, array));
    }

    // Установить строгий CSP
    enforceStrictCSP() {
      const cspPolicy = this.buildCSPPolicy();
      
      // CSP через meta tag имеет ограничения, поэтому создаем упрощенную версию
      const metaCSPPolicy = this.buildMetaCSPPolicy();
      
      // Устанавливаем через meta tag (без frame-ancestors и других server-only директив)
      const existingCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      if (existingCSP) {
        existingCSP.content = metaCSPPolicy;
      } else {
        const meta = document.createElement('meta');
        meta.setAttribute('http-equiv', 'Content-Security-Policy');
        meta.content = metaCSPPolicy;
        document.head.insertBefore(meta, document.head.firstChild);
      }

      console.log('🛡️ CSP enforced via meta tag:', metaCSPPolicy);
      console.log('⚠️ Note: Some directives (frame-ancestors, block-all-mixed-content) require HTTP headers');
    }

    // Построить CSP политику
    buildCSPPolicy() {
      const policy = [
        // Базовая политика - только собственные ресурсы
        `default-src 'self'`,
        
        // Скрипты: разрешаем inline handlers + CDN (без nonce чтобы не блокировать unsafe-inline)
        `script-src 'self' 'unsafe-inline' 'unsafe-hashes' https://telegram.org https://unpkg.com https://cdnjs.cloudflare.com https://cdn.interactjs.io`,
        
        // Стили: собственные + Google Fonts + Bootstrap Icons + inline стили
        `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net`,
        
        // Шрифты: Google Fonts + Bootstrap Icons
        `font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net`,
        
        // Изображения: собственные + GitHub + data URLs для base64
        `img-src 'self' data: https://raw.githubusercontent.com https://oshu-vacancies.github.io https://github.com`,
        
        // Сетевые запросы: Supabase API + Socket.IO CDN + WebSocket серверы + Telegram Bot API
        `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.socket.io https://unpkg.com https://cdnjs.cloudflare.com https://api.telegram.org wss://localhost:* ws://localhost:* wss://*.oshuwork.ru https://*.oshuwork.ru wss://* ws://*`,
        
        // Медиа: только собственные
        `media-src 'self'`,
        
        // Объекты: запрещены (предотвращение Flash, etc.)
        `object-src 'none'`,
        
        // Базовые ресурсы: только собственные
        `base-uri 'self'`,
        
        // Формы: только на собственный домен
        `form-action 'self'`,
        
        // Фреймы: разрешить встраивание в Telegram
        `frame-ancestors 'self' https://web.telegram.org https://telegram.org`,
        
        // Обновление небезопасных запросов
        `upgrade-insecure-requests`,
        
        // Блокировка mixed content
        `block-all-mixed-content`
      ];

      return policy.join('; ');
    }

    // Построить CSP политику для meta tag (без server-only директив)
    buildMetaCSPPolicy() {
      const policy = [
        // Базовая политика - только собственные ресурсы
        `default-src 'self'`,
        
        // Скрипты: разрешаем inline handlers + CDN (без nonce чтобы не блокировать unsafe-inline)
        `script-src 'self' 'unsafe-inline' 'unsafe-hashes' https://telegram.org https://unpkg.com https://cdnjs.cloudflare.com https://cdn.interactjs.io`,
        
        // Стили: собственные + Google Fonts + Bootstrap Icons + inline стили
        `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net`,
        
        // Шрифты: Google Fonts + Bootstrap Icons
        `font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net`,
        
        // Изображения: собственные + GitHub + data URLs для base64
        `img-src 'self' data: https://raw.githubusercontent.com https://oshu-vacancies.github.io https://github.com`,
        
        // Сетевые запросы: Supabase API + Socket.IO CDN + WebSocket серверы + Telegram Bot API
        `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.socket.io https://unpkg.com https://cdnjs.cloudflare.com https://api.telegram.org wss://localhost:* ws://localhost:* wss://*.oshuwork.ru https://*.oshuwork.ru wss://* ws://*`,
        
        // Медиа: только собственные
        `media-src 'self'`,
        
        // Объекты: запрещены (предотвращение Flash, etc.)
        `object-src 'none'`,
        
        // Базовые ресурсы: только собственные
        `base-uri 'self'`,
        
        // Формы: только на собственный домен  
        `form-action 'self'`
        
        // НЕ включаем frame-ancestors, upgrade-insecure-requests, block-all-mixed-content
        // так как они не поддерживаются в meta tags
      ];

      return policy.join('; ');
    }

    // Применить nonce к inline скриптам
    applyNonceToScripts() {
      const inlineScripts = document.querySelectorAll('script:not([src])');
      inlineScripts.forEach(script => {
        if (!script.hasAttribute('nonce')) {
          script.setAttribute('nonce', this.nonce);
        }
      });
    }

    // Применить nonce к inline стилям
    applyNonceToStyles() {
      const inlineStyles = document.querySelectorAll('style');
      inlineStyles.forEach(style => {
        if (!style.hasAttribute('nonce')) {
          style.setAttribute('nonce', this.nonce);
        }
      });
    }

    // Создать style элемент с nonce
    createStyleElement() {
      const style = document.createElement('style');
      style.setAttribute('nonce', this.nonce);
      return style;
    }

    // Настроить отчетность о нарушениях
    setupViolationReporting() {
      document.addEventListener('securitypolicyviolation', (e) => {
        const violation = {
          blockedURI: e.blockedURI,
          violatedDirective: e.violatedDirective,
          originalPolicy: e.originalPolicy,
          documentURI: e.documentURI,
          timestamp: Date.now(),
          userAgent: navigator.userAgent
        };

        this.violations.push(violation);
        
        // Логирование в консоль для отладки
        console.warn('🚨 CSP Violation:', violation);
        
        // В production можно отправлять на сервер
        if (this.shouldReportViolation(violation)) {
          this.reportViolation(violation);
        }
      });
    }

    // Определить, стоит ли отправлять отчет о нарушении
    shouldReportViolation(violation) {
      // Игнорируем некоторые распространенные false positives
      const ignoredSources = [
        'chrome-extension:',
        'moz-extension:',
        'safari-extension:',
        'about:blank'
      ];

      return !ignoredSources.some(source => 
        violation.blockedURI.startsWith(source)
      );
    }

    // Отправить отчет о нарушении
    async reportViolation(violation) {
      try {
        // В будущем можно настроить reporting endpoint
        console.log('📊 Would report CSP violation:', violation);
        
        // Пример отправки (закомментировано):
        // await fetch('/csp-report', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify(violation)
        // });
        
      } catch (error) {
        console.warn('Failed to report CSP violation:', error);
      }
    }

    // Получить статистику нарушений
    getViolationStats() {
      const stats = {};
      
      this.violations.forEach(violation => {
        const directive = violation.violatedDirective;
        stats[directive] = (stats[directive] || 0) + 1;
      });

      return {
        totalViolations: this.violations.length,
        byDirective: stats,
        violations: this.violations
      };
    }

    // Получить текущий nonce
    getNonce() {
      return this.nonce;
    }

    // Проверить совместимость браузера с CSP
    checkBrowserSupport() {
      const features = {
        csp: 'securitypolicyviolation' in document,
        crypto: !!(window.crypto && window.crypto.getRandomValues),
        nonce: true // Все современные браузеры поддерживают nonce
      };

      const isSupported = Object.values(features).every(Boolean);
      
      return {
        supported: isSupported,
        features
      };
    }

    // Инициализация CSP менеджера
    init() {
      const support = this.checkBrowserSupport();
      
      if (!support.supported) {
        console.warn('⚠️ Limited CSP support in this browser:', support.features);
      }

      // Применяем nonce к существующим элементам
      this.applyNonceToScripts();
      this.applyNonceToStyles();

      // Устанавливаем строгую политику
      this.enforceStrictCSP();

      console.log('✅ CSP Manager initialized with nonce:', this.nonce);
    }
  }

  // Создаем глобальный экземпляр
  window.cspManager = new CSPManager();

})();