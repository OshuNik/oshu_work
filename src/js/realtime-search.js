/**
 * Realtime Search Manager - Phase 3.2
 * Real-time поиск с debouncing и WebSocket интеграцией
 */

class RealtimeSearch {
  constructor() {
    this.searchInput = null;
    this.searchResults = new Map();
    this.isSearching = false;
    this.lastQuery = '';
    this.searchHistory = [];

    // Настройки debouncing
    this.debounceDelay = 300; // локальный поиск
    this.serverDebounceDelay = 800; // server-side поиск через WebSocket
    this.minQueryLength = 2;
    this.maxHistoryItems = 10;

    // Таймеры debouncing
    this.localSearchTimer = null;
    this.serverSearchTimer = null;

    // ✅ BUG FIX: Отслеживаем все animation timeouts для очистки
    this.animationTimeouts = new Set();

    // Кэш результатов
    this.searchCache = new Map();
    this.cacheExpiry = 300000; // 5 минут

    this.init();
  }

  /**
   * Инициализация real-time поиска
   */
  init() {
    logger.log('[Realtime Search] Начинаем инициализацию...');
    logger.log('[Realtime Search] DOM ready state:', document.readyState);
    
    this.searchInput = document.getElementById('search-input');
    
    if (!this.searchInput) {
      console.warn('[Realtime Search] Поисковое поле не найдено, доступные элементы с ID:');
      const allIds = Array.from(document.querySelectorAll('[id]')).map(el => el.id);
      console.warn('[Realtime Search] IDs на странице:', allIds);
      return;
    }

    logger.log('[Realtime Search] Поисковое поле найдено:', this.searchInput);
    
    this.setupSearchHandlers();
    this.setupWebSocketListeners();
    
    logger.log('[Realtime Search] ✅ Инициализирован успешно');
  }

  /**
   * Настройка обработчиков поиска
   */
  setupSearchHandlers() {
    // Основной обработчик ввода
    this.searchInput.addEventListener('input', (event) => {
      const query = event.target.value.trim();
      this.handleSearchInput(query);
    });

    // Обработчик фокуса для показа истории
    this.searchInput.addEventListener('focus', () => {
      if (this.searchInput.value.length === 0) {
        this.showSearchHistory();
      }
    });

    // Обработчик клавиш
    this.searchInput.addEventListener('keydown', (event) => {
      this.handleKeyDown(event);
    });

    // Очистка поиска
    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearSearch();
      });
    }
  }

  /**
   * Настройка слушателей WebSocket
   */
  setupWebSocketListeners() {
    // Результаты поиска от сервера
    document.addEventListener('search:results', (event) => {
      this.handleServerSearchResults(event.detail);
    });

    // Fallback когда WebSocket недоступен
    document.addEventListener('search:fallback', (event) => {
      this.handleSearchFallback(event.detail);
    });
  }

  /**
   * Обработка ввода в поисковое поле
   */
  handleSearchInput(query) {
    // Показываем/скрываем кнопку очистки
    this.toggleClearButton(query.length > 0);

    // Сброс если запрос пустой
    if (query.length === 0) {
      this.clearSearchResults();
      this.hideSearchSuggestions();
      return;
    }

    // Проверяем минимальную длину запроса
    if (query.length < this.minQueryLength) {
      this.showMinLengthHint();
      return;
    }

    // Отменяем предыдущие таймеры
    this.cancelDebounceTimers();

    // Локальный поиск с коротким debounce
    this.localSearchTimer = setTimeout(() => {
      this.performLocalSearch(query);
    }, this.debounceDelay);

    // Server-side поиск с длинным debounce
    this.serverSearchTimer = setTimeout(() => {
      this.performServerSearch(query);
    }, this.serverDebounceDelay);

    // Показываем индикатор загрузки
    this.showSearchIndicator(true);
  }

  /**
   * Локальный поиск в уже загруженных вакансиях
   */
  performLocalSearch(query) {
    logger.log('[Realtime Search] Локальный поиск:', query);

    const results = [];
    const normalizedQuery = query.toLowerCase();

    // Поиск в активной категории
    const activeCategory = window.stateManager?.getCurrentCategory() || 'ТОЧНО ТВОЁ';
    const listId = this.mapCategoryToList(activeCategory);
    const vacancyCards = document.querySelectorAll(`#${listId} .vacancy-card`);

    vacancyCards.forEach(card => {
      if (this.matchesVacancy(card, normalizedQuery)) {
        results.push({
          card: card,
          relevance: this.calculateRelevance(card, normalizedQuery)
        });
      }
    });

    // Сортируем по релевантности
    results.sort((a, b) => b.relevance - a.relevance);

    // Показываем результаты локального поиска
    this.displayLocalSearchResults(query, results);
  }

  /**
   * Server-side поиск через WebSocket
   */
  performServerSearch(query) {
    logger.log('[Realtime Search] Server-side поиск:', query);

    // Проверяем кэш
    const cachedResults = this.getFromCache(query);
    if (cachedResults) {
      logger.log('[Realtime Search] Результаты из кэша');
      this.handleServerSearchResults(cachedResults);
      return;
    }

    // Отправляем запрос через WebSocket
    if (window.wsManager && window.wsManager.connected) {
      const activeCategory = window.stateManager?.getCurrentCategory() || 'all';
      
      window.wsManager.search(query, {
        categories: [activeCategory],
        limit: 20,
        includeInactive: false
      });
    } else {
      // Fallback к локальному поиску
      console.warn('[Realtime Search] WebSocket недоступен, используем локальный поиск');
      this.performLocalSearch(query);
    }

    this.lastQuery = query;
  }

  /**
   * Проверка соответствия вакансии запросу
   */
  matchesVacancy(card, query) {
    const title = card.querySelector('[data-element="summary"]')?.textContent?.toLowerCase() || '';
    const company = card.querySelector('[data-element="channel"]')?.textContent?.toLowerCase() || '';
    const category = card.querySelector('[data-element="category"]')?.textContent?.toLowerCase() || '';
    
    return title.includes(query) || 
           company.includes(query) || 
           category.includes(query);
  }

  /**
   * Расчет релевантности результата
   */
  calculateRelevance(card, query) {
    let relevance = 0;
    
    const title = card.querySelector('[data-element="summary"]')?.textContent?.toLowerCase() || '';
    const company = card.querySelector('[data-element="channel"]')?.textContent?.toLowerCase() || '';
    
    // Точное совпадение в заголовке
    if (title.includes(query)) {
      relevance += title.indexOf(query) === 0 ? 100 : 50;
    }
    
    // Совпадение в названии компании
    if (company.includes(query)) {
      relevance += 30;
    }
    
    // Бонус за новые вакансии
    if (card.classList.contains('vacancy-new')) {
      relevance += 20;
    }
    
    return relevance;
  }

  /**
   * Отображение результатов локального поиска
   */
  displayLocalSearchResults(query, results) {
    // Скрываем все вакансии
    this.hideAllVacancies();
    
    // Показываем только найденные
    results.forEach(result => {
      result.card.style.display = 'block';
      this.highlightSearchTerms(result.card, query);
    });
    
    // Обновляем счетчик результатов
    this.updateSearchResultsCount(results.length, true);
    
    // Скрываем индикатор после локального поиска
    this.showSearchIndicator(false);
  }

  /**
   * Обработка результатов server-side поиска
   */
  handleServerSearchResults(data) {
    logger.log('[Realtime Search] Server-side результаты:', data);
    
    if (!data || !data.results) {
      this.showNoResults(data?.query || this.lastQuery);
      return;
    }

    // Кэшируем результаты
    this.cacheResults(data.query, data);
    
    // Добавляем в историю поиска
    this.addToSearchHistory(data.query);
    
    // Отображаем результаты
    this.displayServerSearchResults(data);
    
    // Скрываем индикатор загрузки
    this.showSearchIndicator(false);
  }

  /**
   * Отображение server-side результатов
   */
  displayServerSearchResults(data) {
    const { query, results, total } = data;
    
    // Очищаем текущие результаты
    this.clearSearchResults();
    
    // Создаем контейнер результатов если его нет
    let resultsContainer = document.getElementById('search-results-container');
    if (!resultsContainer) {
      resultsContainer = this.createSearchResultsContainer();
    }
    
    // Отображаем результаты
    results.forEach((vacancy, index) => {
      const card = this.createSearchResultCard(vacancy, query);
      if (card) {
        // ✅ BUG FIX: Отслеживаем animation timeouts
        // Анимация появления с задержкой
        const animTimer = setTimeout(() => {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
          this.animationTimeouts.delete(animTimer);
        }, index * 50);

        this.animationTimeouts.add(animTimer);
        resultsContainer.appendChild(card);
      }
    });
    
    // Обновляем счетчик
    this.updateSearchResultsCount(results.length, false, total);
    
    // Показываем контейнер результатов
    resultsContainer.style.display = 'block';
  }

  /**
   * Создание контейнера результатов поиска
   */
  createSearchResultsContainer() {
    const container = document.createElement('div');
    container.id = 'search-results-container';
    container.className = 'search-results-container';
    container.style.cssText = `
      display: none;
      margin-top: 10px;
      border-radius: 8px;
      background: var(--card-color, #fff);
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    
    // Вставляем после поискового контейнера
    const searchContainer = document.getElementById('search-container');
    if (searchContainer) {
      searchContainer.parentNode.insertBefore(container, searchContainer.nextSibling);
    } else {
      document.querySelector('.content').appendChild(container);
    }
    
    return container;
  }

  /**
   * Создание карточки результата поиска
   */
  createSearchResultCard(vacancy, query) {
    // Используем существующую функцию создания карточек
    if (window.realtimeUpdates) {
      return window.realtimeUpdates.createVacancyCard(vacancy);
    }

    // ✅ FIX: Используем безопасные DOM методы вместо innerHTML
    const card = document.createElement('div');
    card.className = 'vacancy-card search-result-card';
    card.style.cssText = `
      opacity: 0;
      transform: translateY(10px);
      transition: all 300ms ease;
      margin-bottom: 10px;
      padding: 15px;
      border: 1px solid var(--border-color, #ddd);
      border-radius: 6px;
    `;

    // Заголовок с подсветкой
    const titleEl = document.createElement('h3');
    titleEl.className = 'vacancy-title';
    titleEl.innerHTML = this.highlightText(vacancy.title || '', query);
    card.appendChild(titleEl);

    // Компания с подсветкой
    const companyEl = document.createElement('p');
    companyEl.className = 'vacancy-company';
    companyEl.innerHTML = this.highlightText(vacancy.company || '', query);
    card.appendChild(companyEl);

    // Описание с подсветкой
    const descEl = document.createElement('p');
    descEl.className = 'vacancy-description';
    descEl.innerHTML = this.highlightText(vacancy.description || '', query);
    card.appendChild(descEl);

    // Метаинформация (категория и время) - ✅ БЕЗОПАСНО, используем textContent
    const metaEl = document.createElement('div');
    metaEl.className = 'vacancy-meta';

    const categoryEl = document.createElement('span');
    categoryEl.className = 'vacancy-category';
    categoryEl.textContent = vacancy.category || 'NO_CATEGORY'; // ✅ textContent для предотвращения XSS
    metaEl.appendChild(categoryEl);

    const separator = document.createElement('span');
    separator.className = 'meta-separator';
    separator.textContent = ' • ';
    metaEl.appendChild(separator);

    const timestampEl = document.createElement('span');
    timestampEl.className = 'vacancy-timestamp';
    timestampEl.textContent = this.formatTimestamp(vacancy.timestamp);
    metaEl.appendChild(timestampEl);

    card.appendChild(metaEl);

    return card;
  }

  /**
   * Подсветка поисковых терминов
   */
  highlightSearchTerms(card, query) {
    const elements = card.querySelectorAll('[data-element="summary"], [data-element="channel"]');

    elements.forEach(el => {
      if (el.textContent) {
        // ✅ FIX: используем innerHTML только с результатом highlightText который уже эскейпит HTML
        el.innerHTML = this.highlightText(el.textContent, query);
      }
    });
  }

  /**
   * Подсветка текста
   */
  highlightText(text, query) {
    if (!text || !query) return text;

    // ✅ SECURITY: Escape HTML in text
    const escapeHtml = (str) => {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    };

    // ✅ SECURITY: Escape regex special chars in query
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const safeText = escapeHtml(text);
    const safeQuery = escapeRegex(escapeHtml(query));

    const regex = new RegExp(`(${safeQuery})`, 'gi');
    return safeText.replace(regex, '<mark class="highlight">$1</mark>');
  }

  /**
   * Скрытие всех вакансий
   */
  hideAllVacancies() {
    const allCards = document.querySelectorAll('.vacancy-card');
    allCards.forEach(card => {
      card.style.display = 'none';
    });
  }

  /**
   * Очистка результатов поиска
   */
  clearSearchResults() {
    // Показываем все вакансии обратно
    const allCards = document.querySelectorAll('.vacancy-card');
    allCards.forEach(card => {
      card.style.display = 'block';
      
      // Убираем подсветку
      const highlighted = card.querySelectorAll('.highlight');
      highlighted.forEach(el => {
        el.outerHTML = el.textContent;
      });
    });
    
    // Скрываем контейнер server-side результатов
    const resultsContainer = document.getElementById('search-results-container');
    if (resultsContainer) {
      resultsContainer.style.display = 'none';
      resultsContainer.innerHTML = '';
    }
  }

  /**
   * Очистка поиска
   */
  clearSearch() {
    this.searchInput.value = '';
    this.cancelDebounceTimers();
    this.clearSearchResults();
    this.hideSearchSuggestions();
    this.showSearchIndicator(false);
    this.toggleClearButton(false);
    
    // Обновляем счетчик
    this.updateSearchResultsCount(0);
    
    this.searchInput.focus();
  }

  /**
   * Отмена таймеров debouncing
   */
  cancelDebounceTimers() {
    if (this.localSearchTimer) {
      clearTimeout(this.localSearchTimer);
      this.localSearchTimer = null;
    }

    if (this.serverSearchTimer) {
      clearTimeout(this.serverSearchTimer);
      this.serverSearchTimer = null;
    }

    // ✅ BUG FIX: Также очищаем animation timeouts
    for (const timer of this.animationTimeouts) {
      clearTimeout(timer);
    }
    this.animationTimeouts.clear();
  }

  /**
   * Показ/скрытие индикатора поиска
   */
  showSearchIndicator(show) {
    const indicator = document.querySelector('.search-indicator') || this.createSearchIndicator();
    
    if (show) {
      indicator.style.display = 'block';
      this.isSearching = true;
    } else {
      indicator.style.display = 'none';
      this.isSearching = false;
    }
  }

  /**
   * Создание индикатора поиска
   */
  createSearchIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'search-indicator';
    indicator.style.cssText = `
      display: none;
      position: absolute;
      right: 40px;
      top: 50%;
      transform: translateY(-50%);
      width: 16px;
      height: 16px;
      border: 2px solid #ccc;
      border-top: 2px solid #007bff;
      border-radius: 50%;
      animation: search-spin 1s linear infinite;
    `;
    
    // Добавляем в поисковый контейнер
    const searchWrapper = this.searchInput.parentElement;
    if (searchWrapper) {
      searchWrapper.style.position = 'relative';
      searchWrapper.appendChild(indicator);
    }
    
    return indicator;
  }

  /**
   * Показ/скрытие кнопки очистки
   */
  toggleClearButton(show) {
    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) {
      clearBtn.style.display = show ? 'block' : 'none';
    }
  }

  /**
   * Обновление счетчика результатов
   */
  updateSearchResultsCount(count, isLocal = false, total = null) {
    let countText = '';
    
    if (count === 0) {
      countText = '';
    } else if (isLocal) {
      countText = `${count} из загруженных`;
    } else if (total && total > count) {
      countText = `${count} из ${total}`;
    } else {
      countText = `${count} найдено`;
    }
    
    // Обновляем в UI если есть элемент
    const countEl = document.querySelector('.search-results-count');
    if (countEl) {
      countEl.textContent = countText;
    }
  }

  /**
   * Показ подсказки о минимальной длине запроса
   */
  showMinLengthHint() {
    // Показываем подсказку
    this.showSearchSuggestion(`Введите минимум ${this.minQueryLength} символа для поиска`);
  }

  /**
   * Показ отсутствия результатов
   */
  showNoResults(query) {
    this.showSearchSuggestion(`По запросу "${query}" ничего не найдено`);
    this.updateSearchResultsCount(0);
  }

  /**
   * Показ поисковых предложений
   */
  showSearchSuggestion(message) {
    // Реализация показа предложений
    logger.log('[Realtime Search] Предложение:', message);
  }

  /**
   * Скрытие поисковых предложений
   */
  hideSearchSuggestions() {
    // Реализация скрытия предложений
  }

  /**
   * Кэширование результатов
   */
  cacheResults(query, data) {
    this.searchCache.set(query.toLowerCase(), {
      data: data,
      timestamp: Date.now()
    });
  }

  /**
   * Получение из кэша
   */
  getFromCache(query) {
    const cached = this.searchCache.get(query.toLowerCase());
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      return cached.data;
    }
    
    return null;
  }

  /**
   * Добавление в историю поиска
   */
  addToSearchHistory(query) {
    if (!query || query.length < this.minQueryLength) return;
    
    // Убираем дубликаты
    this.searchHistory = this.searchHistory.filter(item => item !== query);
    
    // Добавляем в начало
    this.searchHistory.unshift(query);
    
    // Ограничиваем размер истории
    if (this.searchHistory.length > this.maxHistoryItems) {
      this.searchHistory = this.searchHistory.slice(0, this.maxHistoryItems);
    }
    
    // Сохраняем в localStorage
    try {
      localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
    } catch (error) {
      console.warn('[Realtime Search] Не удалось сохранить историю:', error);
    }
  }

  /**
   * Показ истории поиска
   */
  showSearchHistory() {
    if (this.searchHistory.length === 0) return;
    
    logger.log('[Realtime Search] История поиска:', this.searchHistory);
    // Реализация показа истории поиска
  }

  /**
   * Обработка нажатий клавиш
   */
  handleKeyDown(event) {
    switch (event.key) {
      case 'Escape':
        this.clearSearch();
        break;
      case 'Enter':
        event.preventDefault();
        if (this.searchInput.value.length >= this.minQueryLength) {
          this.performServerSearch(this.searchInput.value);
        }
        break;
    }
  }

  /**
   * Fallback обработка поиска
   */
  handleSearchFallback(data) {
    logger.log('[Realtime Search] Fallback поиск:', data);
    this.performLocalSearch(data.query);
  }

  /**
   * Маппинг категории на список
   */
  mapCategoryToList(category) {
    const categoryMap = {
      'ТОЧНО ТВОЁ': 'vacancies-list-main',
      'МОЖЕТ БЫТЬ': 'vacancies-list-maybe',
      'НЕ ТВОЁ': 'vacancies-list-other'
    };
    return categoryMap[category] || 'vacancies-list-main';
  }

  /**
   * Форматирование timestamp
   */
  formatTimestamp(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Получение статистики
   */
  getStats() {
    return {
      isSearching: this.isSearching,
      lastQuery: this.lastQuery,
      cacheSize: this.searchCache.size,
      historyLength: this.searchHistory.length,
      debounceDelay: this.debounceDelay,
      serverDebounceDelay: this.serverDebounceDelay
    };
  }
}

// CSS стили для поиска
const searchStyles = `
@keyframes search-spin {
  0% { transform: translateY(-50%) rotate(0deg); }
  100% { transform: translateY(-50%) rotate(360deg); }
}

/* Подсветка поиска использует существующий стиль .highlight из style.css */

.search-result-card {
  cursor: pointer;
  transition: all 200ms ease;
}

.search-result-card:hover {
  background-color: var(--hover-color, #f5f5f5);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.search-results-container {
  max-height: 400px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.search-indicator {
  pointer-events: none;
}
`;

// Добавляем стили
const searchStyleSheet = document.createElement('style');
searchStyleSheet.textContent = searchStyles;
document.head.appendChild(searchStyleSheet);

// Глобальный экспорт
window.RealtimeSearch = RealtimeSearch;

// Инициализируем после загрузки DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.realtimeSearch = new RealtimeSearch();
    logger.log('[Phase 3.2] Realtime Search Manager инициализирован после DOMContentLoaded');
  });
} else {
  // DOM уже загружен
  window.realtimeSearch = new RealtimeSearch();
  logger.log('[Phase 3.2] Realtime Search Manager инициализирован сразу');
}