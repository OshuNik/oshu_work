// utils-xss-patch.js - Временный патч для XSS protection в utils.min.js

(function() {
  'use strict';

  function patchCreateVacancyCard() {
    if (!window.utils || !window.sanitizer) {
      console.warn('[XSS Patch] Waiting for utils and sanitizer...');
      setTimeout(patchCreateVacancyCard, 100);
      return;
    }

    const originalCreateVacancyCard = window.utils.createVacancyCard;

    if (!originalCreateVacancyCard) {
      console.error('[XSS Patch] createVacancyCard not found!');
      return;
    }

    // Wrap original function с sanitization
    window.utils.createVacancyCard = function(v, options = {}) {
      const card = originalCreateVacancyCard(v, options);

      // Найти fullText element и sanitize его innerHTML
      const fullText = card.querySelector('[data-element="full-text"]');

      if (fullText && fullText.innerHTML) {
        try {
          const safeHTML = window.sanitizer.sanitizeHTML(fullText.innerHTML, {
            allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'span', 'div', 'ul', 'ol', 'li'],
            allowedAttrs: {
              'a': ['href', 'title', 'target', 'rel'],
              'span': ['class'],
              'div': ['class'],
              '*': ['class']
            }
          });

          fullText.innerHTML = safeHTML;
        } catch (error) {
          console.error('[XSS Patch] Failed to sanitize:', error);
          // Fallback - удалить все HTML
          fullText.textContent = fullText.textContent;
        }
      }

      // Также sanitize summary если есть поиск
      const summary = card.querySelector('[data-element="summary"]');
      if (summary && summary.innerHTML && summary.innerHTML.includes('<mark')) {
        // Mark tags безопасны, но проверим остальное
        try {
          const safeSummary = window.sanitizer.sanitizeHTML(summary.innerHTML, {
            allowedTags: ['mark', 'strong', 'b', 'em', 'i'],
            allowedAttrs: {
              'mark': ['class']
            }
          });
          summary.innerHTML = safeSummary;
        } catch (error) {
          console.error('[XSS Patch] Failed to sanitize summary:', error);
        }
      }

      return card;
    };

    console.log('✅ [XSS Patch] createVacancyCard patched with sanitizer');
  }

  // Запуск патча
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchCreateVacancyCard);
  } else {
    patchCreateVacancyCard();
  }
})();
