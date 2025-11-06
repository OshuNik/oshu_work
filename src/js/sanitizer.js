// sanitizer.js - XSS Protection Module
// Lightweight HTML sanitizer для защиты от XSS атак

(function() {
  'use strict';

  /**
   * Sanitize HTML - удаляет опасные элементы и атрибуты
   * Использует DOMParser для безопасного парсинга (без выполнения скриптов)
   * @param {string} html - HTML для очистки
   * @param {object} options - Опции санитизации
   * @returns {string} - Безопасный HTML
   */
  function sanitizeHTML(html, options = {}) {
    if (!html || typeof html !== 'string') {
      return '';
    }

    // Allowed tags (whitelist)
    const ALLOWED_TAGS = options.allowedTags || [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u',
      'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'blockquote', 'pre', 'code'
    ];

    // Allowed attributes (whitelist)
    const ALLOWED_ATTRS = options.allowedAttrs || {
      'a': ['href', 'title', 'target', 'rel'],
      'span': ['class'],
      'div': ['class'],
      '*': ['class'] // class разрешен для всех
    };

    // БЕЗОПАСНЫЙ парсинг: используем DOMParser вместо innerHTML
    // DOMParser не выполняет скрипты при парсинге
    let temp;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      temp = document.createElement('div');
      // Копируем parsed nodes в temp вместо прямого использования innerHTML
      Array.from(doc.body.childNodes).forEach(node => {
        temp.appendChild(node.cloneNode(true));
      });
    } catch (error) {
      console.warn('[Sanitizer] DOMParser error, falling back to safe mode:', error);
      // Fallback: используем textContent для полной безопасности
      temp = document.createElement('div');
      temp.textContent = html;
      return temp.textContent;
    }

    // Рекурсивно очищаем все узлы
    function cleanNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return null;
      }

      const tagName = node.tagName.toLowerCase();

      // Проверяем разрешен ли тег
      if (!ALLOWED_TAGS.includes(tagName)) {
        // Заменяем тег на его содержимое
        const textNode = document.createTextNode(node.textContent);
        return textNode;
      }

      // Очищаем атрибуты
      const allowedAttrsForTag = ALLOWED_ATTRS[tagName] || ALLOWED_ATTRS['*'] || [];
      const attrs = Array.from(node.attributes);

      attrs.forEach(attr => {
        const attrName = attr.name.toLowerCase();

        // Удаляем все on* event handlers
        if (attrName.startsWith('on')) {
          node.removeAttribute(attr.name);
          return;
        }

        // Удаляем опасные атрибуты
        if (['style', 'onerror', 'onclick', 'onload'].includes(attrName)) {
          node.removeAttribute(attr.name);
          return;
        }

        // Проверяем whitelist атрибутов
        if (!allowedAttrsForTag.includes(attrName)) {
          node.removeAttribute(attr.name);
          return;
        }

        // Дополнительная проверка для href
        if (attrName === 'href') {
          const href = attr.value.toLowerCase().trim();

          // Блокируем javascript: и data:
          if (href.startsWith('javascript:') ||
              href.startsWith('data:') ||
              href.startsWith('vbscript:')) {
            node.removeAttribute(attr.name);
            return;
          }

          // Если есть, автоматически добавляем rel="noopener noreferrer"
          if (!node.hasAttribute('rel')) {
            node.setAttribute('rel', 'noopener noreferrer');
          }

          // Если external link, добавляем target="_blank"
          if (href.startsWith('http') && !node.hasAttribute('target')) {
            node.setAttribute('target', '_blank');
          }
        }
      });

      // Рекурсивно очищаем детей
      Array.from(node.childNodes).forEach(child => {
        const cleaned = cleanNode(child);
        if (!cleaned) {
          node.removeChild(child);
        }
      });

      return node;
    }

    // Очищаем все дочерние узлы
    Array.from(temp.childNodes).forEach(child => {
      cleanNode(child);
    });

    return temp.innerHTML;
  }

  /**
   * Escape HTML - превращает HTML в plain text
   * Используется когда нужен только текст без форматирования
   */
  function escapeHTML(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };

    return text.replace(/[&<>"'/]/g, char => map[char]);
  }

  /**
   * Strip all HTML tags - оставляет только текст
   * БЕЗОПАСНО: использует DOMParser вместо innerHTML
   */
  function stripHTML(html) {
    if (!html || typeof html !== 'string') {
      return '';
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      return doc.body.textContent || '';
    } catch (error) {
      console.warn('[Sanitizer] stripHTML error:', error);
      // Fallback: используем регулярное выражение для удаления HTML тегов
      return html.replace(/<[^>]*>/g, '');
    }
  }

  /**
   * Sanitize URL - проверяет безопасность URL
   */
  function sanitizeURL(url) {
    if (!url || typeof url !== 'string') {
      return '';
    }

    const trimmed = url.trim();

    // Allowed protocols
    const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:', 'tg:'];

    try {
      const parsed = new URL(trimmed);

      if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        console.warn('[Sanitizer] Blocked URL with invalid protocol:', parsed.protocol);
        return '';
      }

      return parsed.href;
    } catch (error) {
      // Если не валидный URL
      console.warn('[Sanitizer] Invalid URL:', trimmed);
      return '';
    }
  }

  /**
   * Validate and sanitize input - для форм
   */
  function validateInput(value, type = 'text', options = {}) {
    if (value === null || value === undefined) {
      return { valid: false, value: '', error: 'Значение не может быть пустым' };
    }

    const stringValue = String(value).trim();

    // Max length check
    const maxLength = options.maxLength || 1000;
    if (stringValue.length > maxLength) {
      return {
        valid: false,
        value: stringValue.substring(0, maxLength),
        error: `Максимальная длина: ${maxLength} символов`
      };
    }

    // Min length check
    const minLength = options.minLength || 0;
    if (stringValue.length < minLength) {
      return {
        valid: false,
        value: stringValue,
        error: `Минимальная длина: ${minLength} символов`
      };
    }

    switch (type) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(stringValue)) {
          return { valid: false, value: stringValue, error: 'Неверный формат email' };
        }
        break;

      case 'url':
        try {
          new URL(stringValue);
        } catch (e) {
          return { valid: false, value: stringValue, error: 'Неверный формат URL' };
        }
        break;

      case 'number':
        const num = parseFloat(stringValue);
        if (isNaN(num)) {
          return { valid: false, value: stringValue, error: 'Должно быть число' };
        }
        return { valid: true, value: num, sanitized: num };

      case 'text':
      default:
        // Remove potential SQL/XSS patterns
        const dangerous = /(<script|javascript:|onerror=|onclick=|<iframe|eval\(|alert\()/i;
        if (dangerous.test(stringValue)) {
          return {
            valid: false,
            value: escapeHTML(stringValue),
            error: 'Обнаружены недопустимые символы'
          };
        }
        break;
    }

    return {
      valid: true,
      value: stringValue,
      sanitized: escapeHTML(stringValue)
    };
  }

  // Export to global scope
  window.sanitizer = {
    sanitizeHTML,
    escapeHTML,
    stripHTML,
    sanitizeURL,
    validateInput
  };

  console.log('✅ [Sanitizer] XSS Protection module loaded');

})();
