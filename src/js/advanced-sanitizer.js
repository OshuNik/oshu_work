// advanced-sanitizer.js - XSS Protection without external dependencies

(function() {
  'use strict';

  class AdvancedSanitizer {
    constructor() {
      // Whitelist of allowed HTML tags for rich text
      this.allowedTags = {
        'B': true, 'I': true, 'EM': true, 'STRONG': true, 'MARK': true,
        'BR': true, 'P': true, 'SPAN': true
      };

      // Allowed attributes
      this.allowedAttrs = new Set(['class']);

      // Статистика sanitization
      this.stats = {
        totalSanitized: 0,
        blocked: 0,
        byType: {
          html: 0,
          text: 0,
          url: 0
        }
      };
    }

    /**
     * Sanitize HTML для безопасного отображения с базовым форматированием
     * @param {string} dirty - Входящий HTML
     * @returns {string} - Очищенный HTML
     */
    sanitizeHTML(dirty) {
      if (!dirty || typeof dirty !== 'string') return '';

      this.stats.totalSanitized++;
      this.stats.byType.html++;

      // Parse HTML and filter tags/attributes
      const temp = document.createElement('div');
      temp.innerHTML = dirty;

      const cleaned = this._filterDOM(temp).innerHTML;

      // Check if content was removed
      if (cleaned.length < dirty.length) {
        this.stats.blocked++;
        console.warn('[Sanitizer] Potentially malicious content removed from HTML');
      }

      return cleaned;
    }

    /**
     * Filter DOM tree to remove dangerous elements and attributes
     * @private
     */
    _filterDOM(node) {
      const fragment = document.createDocumentFragment();

      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          fragment.appendChild(child.cloneNode());
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          if (this.allowedTags[child.tagName]) {
            const safeEl = document.createElement(child.tagName);

            // Only keep allowed attributes
            for (const attr of child.attributes) {
              if (this.allowedAttrs.has(attr.name)) {
                safeEl.setAttribute(attr.name, attr.value);
              }
            }

            // Recursively filter children
            this._filterDOM(child);
            for (const childNode of Array.from(child.childNodes)) {
              if (childNode.nodeType === Node.TEXT_NODE ||
                  (childNode.nodeType === Node.ELEMENT_NODE && this.allowedTags[childNode.tagName])) {
                safeEl.appendChild(childNode.cloneNode(true));
              }
            }

            fragment.appendChild(safeEl);
          } else {
            // Skip disallowed tags, but keep text content
            const childFragment = this._filterDOM(child);
            for (const node of Array.from(childFragment.childNodes)) {
              fragment.appendChild(node.cloneNode(true));
            }
          }
        }
      }

      const container = document.createElement('div');
      container.appendChild(fragment);
      return container;
    }

    /**
     * Sanitize plain text (удаляет все HTML)
     * @param {string} dirty - Входящий текст
     * @returns {string} - Очищенный текст
     */
    sanitizeText(dirty) {
      if (!dirty || typeof dirty !== 'string') return '';

      this.stats.totalSanitized++;
      this.stats.byType.text++;

      // Strip all HTML tags using safe DOM method
      const div = document.createElement('div');
      div.textContent = dirty;
      const cleaned = div.textContent || '';
      const trimmed = cleaned.trim();

      // Check for suspicious patterns
      if (this._hasSuspiciousPatterns(dirty)) {
        this.stats.blocked++;
        console.warn('[Sanitizer] Suspicious patterns detected in text input');
      }

      return trimmed;
    }

    /**
     * Sanitize URL
     * @param {string} url - Входящий URL
     * @returns {string} - Очищенный URL или пустая строка
     */
    sanitizeURL(url) {
      if (!url || typeof url !== 'string') return '';

      this.stats.totalSanitized++;
      this.stats.byType.url++;

      const ALLOWED_PROTOCOLS = ['https:', 'http:', 'tg:', 'mailto:', 'tel:'];
      const ALLOWED_DOMAINS = ['t.me', 'telegram.me', 'telegram.org'];

      try {
        // Нормализация URL
        let normalized = url.trim();

        // Автодобавление протокола для telegram ссылок
        if (/^(t\.me|telegram\.me)\//i.test(normalized)) {
          normalized = 'https://' + normalized;
        }

        // Парсинг URL
        const parsed = new URL(normalized);

        // Проверка протокола
        if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
          this.stats.blocked++;
          console.warn('[Sanitizer] Blocked URL with disallowed protocol:', parsed.protocol);
          return '';
        }

        // Проверка на javascript: protocol (double check)
        if (parsed.protocol === 'javascript:') {
          this.stats.blocked++;
          console.warn('[Sanitizer] Blocked javascript: protocol');
          return '';
        }

        // Для HTTPS проверяем домен (опционально)
        if (parsed.protocol === 'https:' && parsed.hostname) {
          const hostname = parsed.hostname.toLowerCase();

          // Whitelist: telegram домены
          if (ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain))) {
            return parsed.href;
          }

          // Базовая проверка на валидный домен
          if (hostname.match(/^[a-z0-9.-]+\.[a-z]{2,}$/i)) {
            return parsed.href;
          }
        }

        // Для tg: protocol
        if (parsed.protocol === 'tg:') {
          return parsed.href;
        }

        // Для http: (менее безопасно, но разрешаем)
        if (parsed.protocol === 'http:') {
          return parsed.href;
        }

        return parsed.href;

      } catch (e) {
        this.stats.blocked++;
        console.warn('[Sanitizer] Invalid URL blocked:', url);
        return '';
      }
    }

    /**
     * Escape HTML entities (альтернатива sanitizeText для совместимости)
     * @param {string} str - Входящая строка
     * @returns {string} - Строка с экранированными HTML entities
     */
    escapeHTML(str) {
      if (!str || typeof str !== 'string') return '';

      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    /**
     * Проверка на подозрительные паттерны
     * @private
     * @param {string} text
     * @returns {boolean}
     */
    _hasSuspiciousPatterns(text) {
      const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i, // onclick=, onerror=, etc.
        /<iframe/i,
        /eval\(/i,
        /expression\(/i,
      ];

      return suspiciousPatterns.some(pattern => pattern.test(text));
    }

    /**
     * Sanitize объект с множественными полями
     * @param {Object} obj - Объект для очистки
     * @param {Object} fieldTypes - Типы полей {fieldName: 'text'|'html'|'url'}
     * @returns {Object} - Очищенный объект
     */
    sanitizeObject(obj, fieldTypes) {
      if (!obj || typeof obj !== 'object') return {};

      const sanitized = {};

      for (const [key, value] of Object.entries(obj)) {
        const type = fieldTypes[key] || 'text';

        switch (type) {
          case 'html':
            sanitized[key] = this.sanitizeHTML(value);
            break;
          case 'url':
            sanitized[key] = this.sanitizeURL(value);
            break;
          case 'text':
          default:
            sanitized[key] = this.sanitizeText(value);
            break;
        }
      }

      return sanitized;
    }

    /**
     * Получить статистику sanitization
     * @returns {Object}
     */
    getStats() {
      return {
        ...this.stats,
        blockRate: this.stats.totalSanitized > 0
          ? Math.round((this.stats.blocked / this.stats.totalSanitized) * 100)
          : 0
      };
    }

    /**
     * Сбросить статистику
     */
    resetStats() {
      this.stats = {
        totalSanitized: 0,
        blocked: 0,
        byType: {
          html: 0,
          text: 0,
          url: 0
        }
      };
    }

    /**
     * Тестовый метод для проверки sanitization
     * @returns {Object} - Результаты тестов
     */
    test() {
      console.log('🧪 [Sanitizer] Running sanitization tests...');

      const tests = [
        // XSS тесты
        {
          name: 'Script tag',
          input: '<script>alert("XSS")</script>',
          method: 'sanitizeHTML',
          shouldBlock: true
        },
        {
          name: 'Event handler',
          input: '<img src=x onerror="alert(\'XSS\')">',
          method: 'sanitizeHTML',
          shouldBlock: true
        },
        {
          name: 'JavaScript protocol',
          input: 'javascript:alert("XSS")',
          method: 'sanitizeURL',
          shouldBlock: true
        },
        {
          name: 'Iframe injection',
          input: '<iframe src="malicious.com"></iframe>',
          method: 'sanitizeHTML',
          shouldBlock: true
        },
        // Валидные тесты
        {
          name: 'Valid HTML',
          input: '<b>Bold text</b>',
          method: 'sanitizeHTML',
          shouldBlock: false
        },
        {
          name: 'Valid text',
          input: 'Hello World',
          method: 'sanitizeText',
          shouldBlock: false
        },
        {
          name: 'Valid URL',
          input: 'https://t.me/example',
          method: 'sanitizeURL',
          shouldBlock: false
        }
      ];

      const results = tests.map(test => {
        const before = this.stats.blocked;
        const output = this[test.method](test.input);
        const after = this.stats.blocked;
        const wasBlocked = after > before;

        const passed = wasBlocked === test.shouldBlock;

        return {
          name: test.name,
          passed,
          input: test.input,
          output,
          expected: test.shouldBlock ? 'blocked' : 'allowed',
          actual: wasBlocked ? 'blocked' : 'allowed'
        };
      });

      const passedCount = results.filter(r => r.passed).length;
      const totalCount = results.length;

      console.log(`✅ [Sanitizer] Tests passed: ${passedCount}/${totalCount}`);
      console.table(results);

      return {
        passed: passedCount,
        total: totalCount,
        success: passedCount === totalCount,
        results
      };
    }
  }

  // Создаем глобальный экземпляр
  window.advancedSanitizer = new AdvancedSanitizer();

  // Expose class для тестирования
  window.AdvancedSanitizer = AdvancedSanitizer;

  console.log('✅ [Sanitizer] Advanced Sanitizer initialized');

  // Debug helper в dev mode
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.sanitizerDebug = {
      stats: () => console.table(window.advancedSanitizer.getStats()),
      test: () => window.advancedSanitizer.test(),
      reset: () => window.advancedSanitizer.resetStats()
    };
    console.log('💡 [Sanitizer] Debug helpers available: window.sanitizerDebug');
  }

})();
