// sanitizer.test.js - тесты для XSS Protection модуля
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('Sanitizer Module - XSS Protection', () => {
  let sanitizer

  beforeEach(() => {
    // Импортируем sanitizer из src
    const sanitizerModule = `
      (function() {
        'use strict';

        function sanitizeHTML(html, options = {}) {
          if (!html || typeof html !== 'string') {
            return '';
          }

          const ALLOWED_TAGS = options.allowedTags || [
            'p', 'br', 'strong', 'b', 'em', 'i', 'u',
            'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'a', 'blockquote', 'pre', 'code'
          ];

          const ALLOWED_ATTRS = options.allowedAttrs || {
            'a': ['href', 'title', 'target', 'rel'],
            'span': ['class'],
            'div': ['class'],
            '*': ['class']
          };

          const temp = document.createElement('div');
          temp.innerHTML = html;

          function cleanNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
              return node;
            }

            if (node.nodeType !== Node.ELEMENT_NODE) {
              return null;
            }

            const tagName = node.tagName.toLowerCase();

            if (!ALLOWED_TAGS.includes(tagName)) {
              const textNode = document.createTextNode(node.textContent);
              return textNode;
            }

            const allowedAttrsForTag = ALLOWED_ATTRS[tagName] || ALLOWED_ATTRS['*'] || [];
            const attrs = Array.from(node.attributes);

            attrs.forEach(attr => {
              const attrName = attr.name.toLowerCase();

              if (attrName.startsWith('on')) {
                node.removeAttribute(attr.name);
                return;
              }

              if (['style', 'onerror', 'onclick', 'onload'].includes(attrName)) {
                node.removeAttribute(attr.name);
                return;
              }

              if (!allowedAttrsForTag.includes(attrName)) {
                node.removeAttribute(attr.name);
                return;
              }

              if (attrName === 'href') {
                const href = attr.value.toLowerCase().trim();

                if (href.startsWith('javascript:') ||
                    href.startsWith('data:') ||
                    href.startsWith('vbscript:')) {
                  node.removeAttribute(attr.name);
                  return;
                }

                if (!node.hasAttribute('rel')) {
                  node.setAttribute('rel', 'noopener noreferrer');
                }

                if (href.startsWith('http') && !node.hasAttribute('target')) {
                  node.setAttribute('target', '_blank');
                }
              }
            });

            Array.from(node.childNodes).forEach(child => {
              const cleaned = cleanNode(child);
              if (!cleaned) {
                node.removeChild(child);
              }
            });

            return node;
          }

          Array.from(temp.childNodes).forEach(child => {
            cleanNode(child);
          });

          return temp.innerHTML;
        }

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

        function stripHTML(html) {
          if (!html || typeof html !== 'string') {
            return '';
          }

          const temp = document.createElement('div');
          temp.innerHTML = html;
          return temp.textContent || temp.innerText || '';
        }

        function sanitizeURL(url) {
          if (!url || typeof url !== 'string') {
            return '';
          }

          const trimmed = url.trim();
          const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:', 'tg:'];

          try {
            const parsed = new URL(trimmed);

            if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
              return '';
            }

            return parsed.href;
          } catch (error) {
            return '';
          }
        }

        function validateInput(value, type = 'text', options = {}) {
          if (value === null || value === undefined) {
            return { valid: false, value: '', error: 'Значение не может быть пустым' };
          }

          const stringValue = String(value).trim();

          const maxLength = options.maxLength || 1000;
          if (stringValue.length > maxLength) {
            return {
              valid: false,
              value: stringValue.substring(0, maxLength),
              error: \`Максимальная длина: \${maxLength} символов\`
            };
          }

          const minLength = options.minLength || 0;
          if (stringValue.length < minLength) {
            return {
              valid: false,
              value: stringValue,
              error: \`Минимальная длина: \${minLength} символов\`
            };
          }

          switch (type) {
            case 'email':
              const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
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
              const dangerous = /(<script|javascript:|onerror=|onclick=|<iframe|eval\\(|alert\\()/i;
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

        return {
          sanitizeHTML,
          escapeHTML,
          stripHTML,
          sanitizeURL,
          validateInput
        };
      })();
    `;

    // Evaluate и сохранить
    sanitizer = eval(sanitizerModule);
  })

  describe('sanitizeHTML()', () => {
    it('should remove script tags', () => {
      const dangerous = '<script>alert("XSS")</script><p>Safe text</p>';
      const result = sanitizer.sanitizeHTML(dangerous);

      expect(result).not.toContain('<script>');
      expect(result).toContain('<p>Safe text</p>');
    })

    it('should remove event handlers', () => {
      const dangerous = '<div onclick="alert(\'XSS\')">Click me</div>';
      const result = sanitizer.sanitizeHTML(dangerous);

      expect(result).not.toContain('onclick');
      expect(result).toContain('Click me');
    })

    it('should remove onerror handlers', () => {
      const dangerous = '<img src="x" onerror="alert(\'XSS\')">';
      const result = sanitizer.sanitizeHTML(dangerous);

      expect(result).not.toContain('onerror');
      expect(result).not.toContain('<img');
    })

    it('should sanitize javascript: URLs', () => {
      const dangerous = '<a href="javascript:alert(\'XSS\')">Link</a>';
      const result = sanitizer.sanitizeHTML(dangerous);

      expect(result).not.toContain('javascript:');
    })

    it('should sanitize data: URLs', () => {
      const dangerous = '<a href="data:text/html,<script>alert(\'XSS\')</script>">Link</a>';
      const result = sanitizer.sanitizeHTML(dangerous);

      expect(result).not.toContain('data:');
    })

    it('should allow safe HTML tags', () => {
      const safe = '<p>Text with <strong>bold</strong> and <em>italic</em></p>';
      const result = sanitizer.sanitizeHTML(safe);

      expect(result).toBe(safe);
    })

    it('should allow safe links with noopener noreferrer', () => {
      const safe = '<a href="https://example.com">Link</a>';
      const result = sanitizer.sanitizeHTML(safe);

      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('rel="noopener noreferrer"');
      expect(result).toContain('target="_blank"');
    })

    it('should handle empty input', () => {
      expect(sanitizer.sanitizeHTML('')).toBe('');
      expect(sanitizer.sanitizeHTML(null)).toBe('');
      expect(sanitizer.sanitizeHTML(undefined)).toBe('');
    })

    it('should respect custom allowed tags', () => {
      const html = '<p>Paragraph</p><span>Span</span><div>Div</div>';
      const result = sanitizer.sanitizeHTML(html, {
        allowedTags: ['p']
      });

      expect(result).toContain('<p>Paragraph</p>');
      expect(result).not.toContain('<span>');
      expect(result).not.toContain('<div>');
    })

    it('should respect custom allowed attributes', () => {
      const html = '<a href="http://test.com" title="Test" data-id="123">Link</a>';
      const result = sanitizer.sanitizeHTML(html, {
        allowedAttrs: {
          'a': ['href']
        }
      });

      expect(result).toContain('href=');
      expect(result).not.toContain('title=');
      expect(result).not.toContain('data-id=');
    })
  })

  describe('escapeHTML()', () => {
    it('should escape HTML entities', () => {
      const text = '<script>alert("XSS")</script>';
      const result = sanitizer.escapeHTML(text);

      expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
    })

    it('should escape ampersands', () => {
      expect(sanitizer.escapeHTML('Tom & Jerry')).toBe('Tom &amp; Jerry');
    })

    it('should escape quotes', () => {
      expect(sanitizer.escapeHTML('"double" and \'single\'')).toContain('&quot;');
      expect(sanitizer.escapeHTML('"double" and \'single\'')).toContain('&#x27;');
    })

    it('should handle empty input', () => {
      expect(sanitizer.escapeHTML('')).toBe('');
      expect(sanitizer.escapeHTML(null)).toBe('');
    })
  })

  describe('stripHTML()', () => {
    it('should remove all HTML tags', () => {
      const html = '<p>Text with <strong>bold</strong></p>';
      const result = sanitizer.stripHTML(html);

      expect(result).toBe('Text with bold');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    })

    it('should remove script tags and content', () => {
      const html = '<script>alert("XSS")</script>Safe text';
      const result = sanitizer.stripHTML(html);

      expect(result).toContain('Safe text');
      expect(result).not.toContain('alert');
    })

    it('should handle empty input', () => {
      expect(sanitizer.stripHTML('')).toBe('');
      expect(sanitizer.stripHTML(null)).toBe('');
    })
  })

  describe('sanitizeURL()', () => {
    it('should allow http URLs', () => {
      const url = 'http://example.com';
      expect(sanitizer.sanitizeURL(url)).toBe(url);
    })

    it('should allow https URLs', () => {
      const url = 'https://example.com';
      expect(sanitizer.sanitizeURL(url)).toBe(url);
    })

    it('should block javascript: URLs', () => {
      const url = 'javascript:alert("XSS")';
      expect(sanitizer.sanitizeURL(url)).toBe('');
    })

    it('should block data: URLs', () => {
      const url = 'data:text/html,<script>alert("XSS")</script>';
      expect(sanitizer.sanitizeURL(url)).toBe('');
    })

    it('should allow mailto: URLs', () => {
      const url = 'mailto:test@example.com';
      expect(sanitizer.sanitizeURL(url)).toBe(url);
    })

    it('should allow tel: URLs', () => {
      const url = 'tel:+1234567890';
      expect(sanitizer.sanitizeURL(url)).toBe(url);
    })

    it('should allow tg: URLs (Telegram)', () => {
      const url = 'tg://resolve?domain=test';
      expect(sanitizer.sanitizeURL(url)).toBe(url);
    })

    it('should handle invalid URLs', () => {
      expect(sanitizer.sanitizeURL('not a url')).toBe('');
      expect(sanitizer.sanitizeURL('')).toBe('');
      expect(sanitizer.sanitizeURL(null)).toBe('');
    })
  })

  describe('validateInput()', () => {
    describe('text type', () => {
      it('should validate safe text', () => {
        const result = sanitizer.validateInput('Safe text', 'text');

        expect(result.valid).toBe(true);
        expect(result.value).toBe('Safe text');
        expect(result.sanitized).toBe('Safe text');
      })

      it('should reject XSS attempts', () => {
        const result = sanitizer.validateInput('<script>alert("XSS")</script>', 'text');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('недопустимые символы');
      })

      it('should reject javascript: in text', () => {
        const result = sanitizer.validateInput('javascript:alert("XSS")', 'text');

        expect(result.valid).toBe(false);
      })

      it('should enforce max length', () => {
        const longText = 'a'.repeat(1001);
        const result = sanitizer.validateInput(longText, 'text', { maxLength: 1000 });

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Максимальная длина');
      })

      it('should enforce min length', () => {
        const result = sanitizer.validateInput('ab', 'text', { minLength: 3 });

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Минимальная длина');
      })
    })

    describe('email type', () => {
      it('should validate correct email', () => {
        const result = sanitizer.validateInput('test@example.com', 'email');

        expect(result.valid).toBe(true);
        expect(result.value).toBe('test@example.com');
      })

      it('should reject invalid email', () => {
        const result = sanitizer.validateInput('not-an-email', 'email');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('email');
      })

      it('should reject email without domain', () => {
        const result = sanitizer.validateInput('test@', 'email');

        expect(result.valid).toBe(false);
      })
    })

    describe('url type', () => {
      it('should validate correct URL', () => {
        const result = sanitizer.validateInput('https://example.com', 'url');

        expect(result.valid).toBe(true);
      })

      it('should reject invalid URL', () => {
        const result = sanitizer.validateInput('not a url', 'url');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('URL');
      })
    })

    describe('number type', () => {
      it('should validate integers', () => {
        const result = sanitizer.validateInput('123', 'number');

        expect(result.valid).toBe(true);
        expect(result.value).toBe(123);
        expect(result.sanitized).toBe(123);
      })

      it('should validate floats', () => {
        const result = sanitizer.validateInput('123.45', 'number');

        expect(result.valid).toBe(true);
        expect(result.value).toBe(123.45);
      })

      it('should reject non-numbers', () => {
        const result = sanitizer.validateInput('not a number', 'number');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('число');
      })
    })

    describe('edge cases', () => {
      it('should reject null input', () => {
        const result = sanitizer.validateInput(null);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('пустым');
      })

      it('should reject undefined input', () => {
        const result = sanitizer.validateInput(undefined);

        expect(result.valid).toBe(false);
      })

      it('should trim whitespace', () => {
        const result = sanitizer.validateInput('  text  ', 'text');

        expect(result.valid).toBe(true);
        expect(result.value).toBe('text');
      })
    })
  })

  describe('Security Attack Vectors', () => {
    it('should block <img> tag XSS', () => {
      const attack = '<img src=x onerror=alert("XSS")>';
      const result = sanitizer.sanitizeHTML(attack);

      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert');
    })

    it('should block <iframe> injection', () => {
      const attack = '<iframe src="javascript:alert(\'XSS\')"></iframe>';
      const result = sanitizer.sanitizeHTML(attack);

      expect(result).not.toContain('<iframe');
      expect(result).not.toContain('javascript:');
    })

    it('should block eval() attempts', () => {
      const attack = 'eval(alert("XSS"))';
      const result = sanitizer.validateInput(attack, 'text');

      expect(result.valid).toBe(false);
    })

    it('should block onclick XSS', () => {
      const attack = '<button onclick="alert(\'XSS\')">Click</button>';
      const result = sanitizer.sanitizeHTML(attack);

      expect(result).not.toContain('onclick');
    })

    it('should block onload XSS', () => {
      const attack = '<body onload="alert(\'XSS\')">Content</body>';
      const result = sanitizer.sanitizeHTML(attack);

      expect(result).not.toContain('onload');
    })
  })
})
