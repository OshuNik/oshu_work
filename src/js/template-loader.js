/**
 * Template Loader - загрузка общих template файлов
 * Основано на Context7 Web Components принципах
 */

class TemplateLoader {
  static cache = new Map();

  /**
   * Загружает и вставляет template из внешнего файла
   * @param {string} templatePath - путь к template файлу
   * @param {string} targetSelector - селектор куда вставить template
   * @returns {Promise<boolean>} - успешность загрузки
   */
  static async loadTemplate(templatePath, targetSelector = 'body') {
    try {
      // Проверяем кэш
      if (this.cache.has(templatePath)) {
        const cached = this.cache.get(templatePath);
        document.querySelector(targetSelector).insertAdjacentHTML('beforeend', cached);
        return true;
      }

      // Загружаем template с fallback путями
      const fallbackPaths = [
        templatePath,
        templatePath.replace('./', ''),  // без ./
        `../${templatePath}`,             // родительская папка
        `/${templatePath.replace('./', '')}` // от корня
      ];
      
      let templateHTML = null;
      let successPath = null;
      
      for (const path of fallbackPaths) {
        try {
          const response = await fetch(path);
          if (response.ok) {
            templateHTML = await response.text();
            successPath = path;
            break;
          }
        } catch (error) {
          // Продолжаем пробовать следующий путь
          continue;
        }
      }
      
      if (!templateHTML) {
        console.warn(`Template not found in any of the paths:`, fallbackPaths);
        // Последний fallback - встроенный template
        if (templatePath.includes('vacancy-card-template')) {
          templateHTML = this.getInlineVacancyCardTemplate();
          console.log('Using inline vacancy card template fallback');
        } else {
          return false;
        }
      }
      
      // Кэшируем с оригинальным путем
      this.cache.set(templatePath, templateHTML);
      
      // Вставляем в DOM
      document.querySelector(targetSelector).insertAdjacentHTML('beforeend', templateHTML);
      
      console.log(`Template loaded successfully from: ${successPath}`);
      return true;
    } catch (error) {
      console.error(`Failed to load template ${templatePath}:`, error);
      return false;
    }
  }

  /**
   * Загружает template карточки вакансии
   * @returns {Promise<boolean>}
   */
  static async loadVacancyCardTemplate() {
    return await this.loadTemplate('./vacancy-card-template.html', 'body');
  }

  /**
   * Проверяет что template загружен и готов к использованию
   * @param {string} templateId - ID template для проверки
   * @returns {boolean}
   */
  static isTemplateReady(templateId) {
    return document.getElementById(templateId) !== null;
  }

  /**
   * Встроенный fallback template для карточки вакансии
   * @returns {string}
   */
  static getInlineVacancyCardTemplate() {
    return `<!-- Fallback vacancy card template -->
<template id="vacancy-card-template">
    <div class="vacancy-card">
    <div class="card-actions">
      <button class="card-action-btn apply" data-element="apply-btn" aria-label="Откликнуться">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><title>Откликнуться на вакансию</title><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>
      </button>
      <button class="card-action-btn favorite" data-element="favorite-btn" aria-label="В избранное">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><title>Добавить в избранное</title><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"/></svg>
      </button>
      <button class="card-action-btn delete" data-element="delete-btn" aria-label="Удалить">
        <svg width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><title>Удалить вакансию</title><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="card-header">
      <h3 data-element="category">NO_CATEGORY</h3>
    </div>
    <div class="card-body">
      <p class="card-summary" data-element="summary"></p>
      <div class="info-window" data-element="info-window"></div>
      <details data-element="details">
        <summary>Показать полный текст</summary>
        <div class="vacancy-text" style="margin-top:10px;">
            <div class="attachments" data-element="attachments"></div>
            <div data-element="full-text"></div>
        </div>
      </details>
    </div>
    <div class="card-footer">
      <div class="footer-skill-tags" data-element="skills"></div>
      <div class="footer-meta">
        <span class="channel-name" data-element="channel"></span>
        <span class="meta-separator"> • </span>
        <span class="timestamp-footer" data-element="timestamp"></span>
      </div>
    </div>
  </div>
</template>`;
  }
}

// Автозагрузка базовых template при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
  // Загружаем vacancy-card-template если нужен
  if (document.querySelector('.vacancy-list') || document.querySelector('#favorites-list')) {
    await TemplateLoader.loadVacancyCardTemplate();
  }
});

// Экспорт для использования в других модулях
window.TemplateLoader = TemplateLoader;