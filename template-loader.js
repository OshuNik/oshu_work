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

      // Загружаем template
      const response = await fetch(templatePath);
      if (!response.ok) {
        console.warn(`Template not found: ${templatePath}`);
        return false;
      }

      const templateHTML = await response.text();
      
      // Кэшируем
      this.cache.set(templatePath, templateHTML);
      
      // Вставляем в DOM
      document.querySelector(targetSelector).insertAdjacentHTML('beforeend', templateHTML);
      
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