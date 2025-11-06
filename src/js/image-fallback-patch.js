// image-fallback-patch.js - Graceful image degradation and fallback handling

(function() {
  'use strict';

  /**
   * ✅ Image Fallback Manager для обработки broken images и graceful degradation
   * Обеспечивает:
   * 1. Валидацию image URLs перед использованием
   * 2. Fallback UI когда images недоступны
   * 3. Placeholder или error state для broken images
   * 4. Graceful degradation при отсутствии images
   */
  class ImageFallbackManager {
    constructor() {
      this.cache = new Map();
      this.validationCache = new Map();
      this.VALIDATION_TTL = 24 * 60 * 60 * 1000; // 24 часов
      this.PLACEHOLDER_ICON = '🖼️'; // Иконка для fallback
      this.ERROR_ICON = '⚠️'; // Иконка для ошибки
    }

    /**
     * Валидировать и подготовить image URL
     * @param {string} url - Image URL
     * @returns {string|null} - Валидный URL или null
     */
    validateImageUrl(url) {
      if (!url || typeof url !== 'string') {
        return null;
      }

      const trimmed = url.trim();
      if (!trimmed) {
        return null;
      }

      // Проверяем кэш валидации
      if (this.validationCache.has(trimmed)) {
        const cached = this.validationCache.get(trimmed);
        if (Date.now() - cached.timestamp < this.VALIDATION_TTL) {
          return cached.isValid ? trimmed : null;
        }
      }

      // Базовая валидация URL
      try {
        const urlObj = new URL(trimmed);

        // Проверяем протокол
        if (!['https:', 'http:', 'data:'].includes(urlObj.protocol)) {
          this.cacheValidation(trimmed, false);
          return null;
        }

        // Проверяем на явные красные флаги
        if (trimmed.includes('javascript:') || trimmed.includes('data:text/html')) {
          this.cacheValidation(trimmed, false);
          return null;
        }

        this.cacheValidation(trimmed, true);
        return trimmed;
      } catch (error) {
        this.cacheValidation(trimmed, false);
        return null;
      }
    }

    /**
     * Кэшировать результат валидации
     * @private
     */
    cacheValidation(url, isValid) {
      this.validationCache.set(url, {
        isValid,
        timestamp: Date.now()
      });
    }

    /**
     * Создать fallback element для broken image
     * @returns {HTMLElement}
     */
    createImageFallback() {
      const fallbackDiv = document.createElement('div');
      fallbackDiv.className = 'image-fallback';
      fallbackDiv.innerHTML = `
        <div class="image-fallback-content">
          <span class="image-fallback-icon">${this.PLACEHOLDER_ICON}</span>
          <span class="image-fallback-text">Изображение недоступно</span>
        </div>
      `;
      return fallbackDiv;
    }

    /**
     * Создать error element для invalid image
     * @returns {HTMLElement}
     */
    createImageError() {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'image-error';
      errorDiv.innerHTML = `
        <div class="image-error-content">
          <span class="image-error-icon">${this.ERROR_ICON}</span>
          <span class="image-error-text">Ошибка загрузки изображения</span>
        </div>
      `;
      return errorDiv;
    }

    /**
     * Обновить image link с fallback handling
     * @param {HTMLElement} linkElement - Image link element
     * @param {string} imageUrl - Image URL
     */
    enhanceImageLink(linkElement, imageUrl) {
      if (!linkElement || !imageUrl) {
        return;
      }

      // Валидируем URL
      const validUrl = this.validateImageUrl(imageUrl);

      if (!validUrl) {
        // URL невалидный - заменяем link на fallback
        const fallback = this.createImageError();
        linkElement.parentElement.replaceChild(fallback, linkElement);
        console.warn('[Image Fallback] Invalid image URL:', imageUrl);
        return;
      }

      // Добавляем обработчик ошибки загрузки
      linkElement.addEventListener('error', (e) => {
        console.warn('[Image Fallback] Failed to load image:', validUrl);
        if (linkElement.parentElement) {
          const fallback = this.createImageFallback();
          linkElement.parentElement.replaceChild(fallback, linkElement);
        }
      }, { once: true, capture: false });

      // Добавляем визуальный feedback при клике
      linkElement.addEventListener('click', (e) => {
        // Пока просто логируем, в будущем может быть более сложная обработка
        console.log('[Image Fallback] User clicked image link:', validUrl);
      });

      // Добавляем data attribute с валидностью
      linkElement.dataset.imageUrl = validUrl;
      linkElement.dataset.imageValidated = 'true';
    }

    /**
     * Обработать attachments контейнер и улучшить все image links
     * @param {HTMLElement} attachmentsContainer - Контейнер с image links
     * @param {string} vacancyId - ID вакансии для логирования
     */
    enhanceAttachments(attachmentsContainer, vacancyId = '') {
      if (!attachmentsContainer) {
        return;
      }

      const imageLinks = attachmentsContainer.querySelectorAll('a.image-link-button');

      if (imageLinks.length === 0) {
        return;
      }

      let validCount = 0;
      let invalidCount = 0;

      imageLinks.forEach((link) => {
        const imageUrl = link.href || link.getAttribute('data-image-url');

        if (this.validateImageUrl(imageUrl)) {
          this.enhanceImageLink(link, imageUrl);
          validCount++;
        } else {
          const error = this.createImageError();
          link.parentElement.replaceChild(error, link);
          invalidCount++;
        }
      });

      if (invalidCount > 0) {
        console.warn(`[Image Fallback] Vacancy ${vacancyId}: ${validCount} valid images, ${invalidCount} invalid`);
      }
    }

    /**
     * Получить статистику валидации
     * @returns {Object}
     */
    getStats() {
      return {
        cachedValidations: this.validationCache.size,
        cacheSize: this.cache.size
      };
    }

    /**
     * Очистить кэши
     */
    clearCache() {
      this.cache.clear();
      this.validationCache.clear();
      console.log('[Image Fallback] Cache cleared');
    }
  }

  // Глобальный экземпляр
  window.imageFallbackManager = new ImageFallbackManager();

  /**
   * Патч createVacancyCard для добавления image degradation
   * Расширяем существующий XSS патч
   */
  function patchCreateVacancyCardImages() {
    if (!window.utils || !window.imageFallbackManager) {
      console.warn('[Image Fallback Patch] Waiting for utils and imageFallbackManager...');
      setTimeout(patchCreateVacancyCardImages, 100);
      return;
    }

    const originalCreateVacancyCard = window.utils.createVacancyCard;

    if (!originalCreateVacancyCard) {
      console.error('[Image Fallback Patch] createVacancyCard not found!');
      return;
    }

    // Оборачиваем оригинальную функцию с обработкой images
    window.utils.createVacancyCard = function(v, options = {}) {
      const card = originalCreateVacancyCard(v, options);

      // Улучшаем attachments с graceful image degradation
      const attachmentsContainer = card.querySelector('[data-element="attachments"]');
      if (attachmentsContainer) {
        window.imageFallbackManager.enhanceAttachments(attachmentsContainer, v.id);
      }

      // Также обрабатываем embedded images в full-text если есть
      const fullText = card.querySelector('[data-element="full-text"]');
      if (fullText) {
        // Проверяем на image markers которые могут быть еще в тексте
        const hasImageMarker = /(\[.*изображени[ея]\s*\]|фото|картинк|скрин)/i.test(fullText.textContent);

        if (hasImageMarker) {
          // Добавляем индикатор что было изображение
          const imageIndicator = document.createElement('div');
          imageIndicator.className = 'text-image-indicator';
          imageIndicator.innerHTML = '<span>📎 Вложено изображение</span>';
          fullText.appendChild(imageIndicator);
        }
      }

      return card;
    };

    console.log('✅ [Image Fallback Patch] createVacancyCard patched with image degradation');
  }

  // Запуск патча
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchCreateVacancyCardImages);
  } else {
    patchCreateVacancyCardImages();
  }

  // Debug helpers для dev mode
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.imageFallbackDebug = {
      stats: () => console.table(window.imageFallbackManager.getStats()),
      clearCache: () => window.imageFallbackManager.clearCache(),
      validateUrl: (url) => window.imageFallbackManager.validateImageUrl(url)
    };
    console.log('💡 [Image Fallback] Debug helpers available: window.imageFallbackDebug');
  }

})();
