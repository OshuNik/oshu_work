/**
 * Vacancy Manager - управляет списком вакансий по категориям
 * Отслеживает загруженные вакансии для предотвращения дублей
 */

class VacancyManager {
  constructor() {
    // Отслеживаем какие вакансии уже загружены в каждой категории
    this.loadedIds = {
      perfect: new Set(),
      maybe: new Set(),
      skip: new Set()
    };
    
    // Вакансии по категориям
    this.vacancies = {
      perfect: [],
      maybe: [],
      skip: []
    };
    
    // Текущая категория
    this.currentCategory = 'perfect';
    
    // Pagination state
    this.pageState = {
      perfect: { page: 1, hasMore: true },
      maybe: { page: 1, hasMore: true },
      skip: { page: 1, hasMore: true }
    };
    
    console.log('[Vacancy Manager] Инициализирован');
  }

  /**
   * Проверяет загружена ли вакансия в категорию
   */
  isVacancyLoaded(category, vacancyId) {
    if (!this.loadedIds[category]) {
      return false;
    }
    return this.loadedIds[category].has(vacancyId);
  }

  /**
   * Отмечает вакансию как загруженную
   */
  markVacancyLoaded(category, vacancyId) {
    if (!this.loadedIds[category]) {
      this.loadedIds[category] = new Set();
    }
    this.loadedIds[category].add(vacancyId);
  }

  /**
   * Отмечает несколько вакансий как загруженные
   */
  markVacanciesLoaded(category, vacancyIds) {
    if (!this.loadedIds[category]) {
      this.loadedIds[category] = new Set();
    }
    
    vacancyIds.forEach(id => {
      this.loadedIds[category].add(id);
    });
  }

  /**
   * Добавляет вакансии в категорию (без дублей)
   */
  addVacancies(category, newVacancies) {
    if (!this.vacancies[category]) {
      this.vacancies[category] = [];
    }

    if (!this.loadedIds[category]) {
      this.loadedIds[category] = new Set();
    }

    // Фильтруем новые вакансии - только те которые еще не загружены
    const uniqueVacancies = newVacancies.filter(v => {
      const isDuplicate = this.loadedIds[category].has(v.id);
      if (!isDuplicate) {
        this.loadedIds[category].add(v.id);
      }
      return !isDuplicate;
    });

    // Добавляем уникальные вакансии
    this.vacancies[category].push(...uniqueVacancies);
    
    console.log(`✅ [Vacancy Manager] Добавлено ${uniqueVacancies.length} уникальных вакансий в ${category}`);
    
    return uniqueVacancies.length;
  }

  /**
   * Получает вакансии по категории
   */
  getVacancies(category) {
    return this.vacancies[category] || [];
  }

  /**
   * Получает количество вакансий в категории
   */
  getCount(category) {
    return this.vacancies[category] ? this.vacancies[category].length : 0;
  }

  /**
   * Получает общее количество вакансий по всем категориям
   */
  getTotalCount() {
    return (
      this.getCount('perfect') + 
      this.getCount('maybe') + 
      this.getCount('skip')
    );
  }

  /**
   * Переключает категорию
   */
  switchCategory(category) {
    if (!this.vacancies[category]) {
      console.warn(`[Vacancy Manager] Категория ${category} не найдена`);
      return false;
    }
    
    this.currentCategory = category;
    console.log(`[Vacancy Manager] Переключено на категорию: ${category}`);
    
    return true;
  }

  /**
   * Получает текущую категорию
   */
  getCurrentCategory() {
    return this.currentCategory;
  }

  /**
   * Перемещает вакансию в другую категорию
   */
  moveVacancy(vacancyId, fromCategory, toCategory) {
    if (!this.vacancies[fromCategory] || !this.vacancies[toCategory]) {
      console.warn('[Vacancy Manager] Неверная категория');
      return false;
    }

    // Находим вакансию
    const index = this.vacancies[fromCategory].findIndex(v => v.id === vacancyId);
    if (index === -1) {
      console.warn(`[Vacancy Manager] Вакансия ${vacancyId} не найдена в ${fromCategory}`);
      return false;
    }

    // Перемещаем вакансию
    const vacancy = this.vacancies[fromCategory].splice(index, 1)[0];
    this.vacancies[toCategory].push(vacancy);

    // Обновляем отслеживание загруженных
    this.loadedIds[fromCategory].delete(vacancyId);
    this.loadedIds[toCategory].add(vacancyId);

    console.log(`[Vacancy Manager] Вакансия ${vacancyId} перемещена из ${fromCategory} в ${toCategory}`);
    
    return true;
  }

  /**
   * Удаляет вакансию из всех категорий
   */
  removeVacancy(vacancyId) {
    let removed = false;

    for (const category in this.vacancies) {
      const index = this.vacancies[category].findIndex(v => v.id === vacancyId);
      if (index !== -1) {
        this.vacancies[category].splice(index, 1);
        this.loadedIds[category].delete(vacancyId);
        removed = true;
        console.log(`[Vacancy Manager] Вакансия ${vacancyId} удалена из ${category}`);
      }
    }

    return removed;
  }

  /**
   * Очищает все вакансии и отслеживание
   */
  clear() {
    this.vacancies = {
      perfect: [],
      maybe: [],
      skip: []
    };
    
    this.loadedIds = {
      perfect: new Set(),
      maybe: new Set(),
      skip: new Set()
    };
    
    this.pageState = {
      perfect: { page: 1, hasMore: true },
      maybe: { page: 1, hasMore: true },
      skip: { page: 1, hasMore: true }
    };

    console.log('[Vacancy Manager] Все данные очищены');
  }

  /**
   * Получает статистику
   */
  getStats() {
    return {
      perfect: {
        count: this.getCount('perfect'),
        loadedIds: this.loadedIds.perfect.size
      },
      maybe: {
        count: this.getCount('maybe'),
        loadedIds: this.loadedIds.maybe.size
      },
      skip: {
        count: this.getCount('skip'),
        loadedIds: this.loadedIds.skip.size
      },
      total: this.getTotalCount(),
      currentCategory: this.currentCategory
    };
  }

  /**
   * Логирует статистику
   */
  logStats() {
    const stats = this.getStats();
    console.log('[Vacancy Manager] Stats:', stats);
  }

  /**
   * Обновляет состояние pagination для категории
   */
  setPaginationState(category, page, hasMore) {
    if (this.pageState[category]) {
      this.pageState[category].page = page;
      this.pageState[category].hasMore = hasMore;
    }
  }

  /**
   * Получает состояние pagination для категории
   */
  getPaginationState(category) {
    return this.pageState[category] || { page: 1, hasMore: true };
  }
}

// Создаем глобальный экземпляр
window.vacancyManager = new VacancyManager();

console.log('[Vacancy Manager] ✅ Глобальный vacancyManager создан');
