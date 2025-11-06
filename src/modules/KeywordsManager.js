// KeywordsManager.js — управление ключевыми словами

import { 
  API_ENDPOINTS, 
  MESSAGES, 
  KEYWORD_PRESETS,
  getUtil,
  log,
  getElement,
  elementExists
} from './SettingsUtils.js';

/**
 * Класс для управления ключевыми словами
 */
export class KeywordsManager {
  constructor() {
    this.currentKeywords = [];
    this.saveTimeout = null;
    this.container = null;
    this.input = null;
    this.utils = null;
    
    this.init();
  }

  /**
   * Инициализация менеджера
   */
  init() {
    // Получаем утилиты
    this.utils = {
      uiToast: getUtil('uiToast'),
      safeAlert: getUtil('safeAlert'),
      createSupabaseHeaders: getUtil('createSupabaseHeaders'),
      escapeHtml: getUtil('escapeHtml')
    };

    // Получаем DOM элементы
    this.container = getElement('current-keywords-tags');
    this.input = getElement('new-keyword-input');

    if (!this.container) {
      log('error', 'Элемент current-keywords-tags не найден');
      return;
    }

    log('log', 'KeywordsManager инициализирован');
  }

  /**
   * Создать тег ключевого слова
   * @param {string} keyword - Ключевое слово
   * @returns {Element} DOM элемент тега
   */
  createKeywordTag(keyword) {
    const tag = document.createElement('div');
    tag.className = 'keyword-tag';

    // ✅ SECURITY FIX: Use advanced sanitizer for XSS protection
    const sanitizedKeyword = window.advancedSanitizer?.sanitizeText(keyword) ||
                            (this.utils.escapeHtml ? this.utils.escapeHtml(keyword) : keyword);

    tag.innerHTML = `
      <span class="keyword-tag-text">${sanitizedKeyword}</span>
      <button class="keyword-tag-remove" type="button" title="Удалить" data-keyword="${sanitizedKeyword}"></button>
    `;
    
    // Добавляем обработчик удаления
    const removeBtn = tag.querySelector('.keyword-tag-remove');
    removeBtn.addEventListener('click', () => {
      this.removeKeyword(keyword);
    });
    
    return tag;
  }

  /**
   * Отобразить теги ключевых слов
   */
  displayKeywordTags() {
    if (!this.container) {
      log('error', 'displayKeywordTags: элемент current-keywords-tags не найден');
      return;
    }
    
    this.container.innerHTML = '';
    
    if (this.currentKeywords.length === 0) {
      this.container.innerHTML = '<div class="loading-indicator">-- ключевые слова не заданы --</div>';
      this.updateKeywordsCount();
      return;
    }
    
    this.currentKeywords.forEach(keyword => {
      if (keyword.trim()) {
        const tag = this.createKeywordTag(keyword.trim());
        this.container.appendChild(tag);
      }
    });
    
    this.updateKeywordsCount();
  }

  /**
   * Обновить счетчик ключевых слов
   */
  updateKeywordsCount() {
    const countBadge = getElement('keywords-count');
    if (countBadge) {
      countBadge.textContent = this.currentKeywords.length.toString();
    }
  }

  /**
   * Добавить одно ключевое слово
   * @param {string} keyword - Ключевое слово
   * @returns {boolean} true если добавлено успешно
   */
  addKeyword(keyword) {
    // ✅ SECURITY FIX: Sanitize input before processing
    const sanitized = window.advancedSanitizer?.sanitizeText(keyword) || keyword;
    const trimmed = sanitized.trim().toLowerCase();

    if (!trimmed || trimmed.length > 30) {
      if (this.utils.safeAlert) {
        this.utils.safeAlert('Ключевое слово должно содержать от 1 до 30 символов');
      }
      return false;
    }
    
    if (this.currentKeywords.map(k => k.toLowerCase()).includes(trimmed)) {
      if (this.utils.safeAlert) {
        this.utils.safeAlert('Такое ключевое слово уже существует');
      }
      return false;
    }
    
    this.currentKeywords.push(trimmed);
    this.debouncedSave();
    this.displayKeywordTags();
    
    return true;
  }

  /**
   * Добавить несколько ключевых слов
   * @param {string} input - Строка с ключевыми словами через запятую
   * @returns {boolean} true если что-то добавлено
   */
  addKeywords(input) {
    const keywords = input.split(',').map(k => k.trim()).filter(k => k.length > 0);
    
    if (keywords.length === 0) {
      if (this.utils.safeAlert) {
        this.utils.safeAlert('Введите хотя бы одно ключевое слово');
      }
      return false;
    }
    
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const keyword of keywords) {
      if (keyword.length > 30) {
        if (this.utils.safeAlert) {
          this.utils.safeAlert(`Ключевое слово "${keyword}" слишком длинное (максимум 30 символов)`);
        }
        continue;
      }
      
      const trimmed = keyword.toLowerCase();
      if (!this.currentKeywords.map(k => k.toLowerCase()).includes(trimmed)) {
        this.currentKeywords.push(trimmed);
        addedCount++;
      } else {
        skippedCount++;
      }
    }
    
    if (addedCount > 0) {
      this.debouncedSave();
      this.displayKeywordTags();
      
      if (skippedCount > 0 && this.utils.safeAlert) {
        this.utils.safeAlert(`Добавлено ${addedCount} слов, пропущено ${skippedCount} дубликатов`);
      }
    } else if (skippedCount > 0 && this.utils.safeAlert) {
      this.utils.safeAlert('Все введённые слова уже существуют');
    }
    
    return addedCount > 0;
  }

  /**
   * Удалить ключевое слово
   * @param {string} keyword - Ключевое слово для удаления
   */
  removeKeyword(keyword) {
    const index = this.currentKeywords.findIndex(k => k.toLowerCase() === keyword.toLowerCase());
    if (index > -1) {
      // Анимация удаления
      const tagElement = this.container.querySelector(`[data-keyword="${keyword}"]`)?.parentElement;
      if (tagElement) {
        tagElement.classList.add('removing');
        setTimeout(() => {
          this.currentKeywords.splice(index, 1);
          this.debouncedSave();
          this.displayKeywordTags();
        }, 200);
      } else {
        this.currentKeywords.splice(index, 1);
        this.debouncedSave();
        this.displayKeywordTags();
      }
    }
  }

  /**
   * Отложенное сохранение для группировки изменений
   */
  debouncedSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.updateKeywordsInDatabase();
    }, 300); // Задержка 300мс для группировки изменений
  }

  /**
   * Обновить ключевые слова в базе данных
   */
  async updateKeywordsInDatabase() {
    const keywordsString = this.currentKeywords.join(', ');
    
    try {
      // Пробуем PATCH для обновления существующей записи
      const response = await fetch(`${API_ENDPOINTS.SETTINGS}?update_key=eq.1`, {
        method: 'PATCH',
        headers: {
          'apikey': window.APP_CONFIG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.APP_CONFIG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ keywords: keywordsString })
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Ошибка авторизации: недействительный API ключ. Очистите кэш браузера (Ctrl+Shift+R) и перезагрузите страницу.');
        }
        if (response.status === 404) {
          // Если записи нет, пробуем создать новую через POST
          const postResponse = await fetch(API_ENDPOINTS.SETTINGS, {
            method: 'POST',
            headers: this.utils.createSupabaseHeaders ? this.utils.createSupabaseHeaders({ prefer: 'resolution=merge-duplicates' }) : {},
            body: JSON.stringify({ update_key: 1, keywords: keywordsString })
          });
          
          if (!postResponse.ok) {
            throw new Error(`POST failed: HTTP ${postResponse.status}: ${postResponse.statusText}`);
          }
          log('log', 'Ключевые слова успешно созданы:', keywordsString);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      log('log', 'Ключевые слова успешно обновлены:', keywordsString);
    } catch (error) {
      log('error', 'Ошибка сохранения ключевых слов:', error);
      if (this.utils.safeAlert) {
        if (error.message.includes('авторизации')) {
          this.utils.safeAlert(error.message);
        } else {
          this.utils.safeAlert('Ошибка сохранения ключевых слов. Проверьте подключение к интернету.');
        }
      }
    }
  }

  /**
   * Загрузить ключевые слова из базы данных
   */
  async loadKeywords() {
    if (!this.container) {
      log('error', 'loadKeywords: элемент current-keywords-tags не найден');
      return;
    }
    
    this.container.innerHTML = '<div class="loading-indicator">Загрузка...</div>';
    
    try {
      const response = await fetch(`${API_ENDPOINTS.SETTINGS}?select=keywords`, {
        headers: {
          'apikey': window.APP_CONFIG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.APP_CONFIG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Ошибка авторизации: недействительный API ключ. Обратитесь к разработчику для обновления конфигурации.');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const keywords = data.length > 0 ? data[0].keywords : '';
      
      // Парсим ключевые слова
      this.currentKeywords = keywords ? keywords.split(',').map(k => k.trim()).filter(k => k) : [];
      
      // Отображаем теги ключевых слов
      this.displayKeywordTags();
    } catch (error) {
      log('error', 'loadKeywords: произошла ошибка', error);
      // ✅ FIX: Используем textContent вместо innerHTML для предотвращения DOM XSS
      this.container.innerHTML = '';
      const errorDiv = document.createElement('div');
      errorDiv.className = 'loading-indicator error-indicator';

      if (error.message.includes('авторизации')) {
        // ✅ SAFE: textContent не интерпретирует HTML
        errorDiv.textContent = error.message;
      } else {
        errorDiv.textContent = 'Ошибка загрузки';
      }
      this.container.appendChild(errorDiv);
    }
  }

  /**
   * Сохранить ключевые слова
   */
  async saveKeywords() {
    if (!this.currentKeywords || this.currentKeywords.length === 0) {
      if (this.utils.safeAlert) {
        this.utils.safeAlert('Нет ключевых слов для сохранения');
      }
      return;
    }
    
    try {
      // Формируем строку ключевых слов из массива
      const keywordsString = this.currentKeywords.join(', ');
      
      // Используем PATCH для обновления как в updateKeywordsInDatabase
      const response = await fetch(`${API_ENDPOINTS.SETTINGS}?update_key=eq.1`, {
        method: 'PATCH',
        headers: {
          'apikey': window.APP_CONFIG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.APP_CONFIG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ keywords: keywordsString })
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Ошибка авторизации: недействительный API ключ. Очистите кэш браузера (Ctrl+Shift+R) и перезагрузите страницу.');
        }
        if (response.status === 404) {
          // Если записи нет, пробуем создать новую через POST
          const postResponse = await fetch(API_ENDPOINTS.SETTINGS, {
            method: 'POST',
            headers: this.utils.createSupabaseHeaders ? this.utils.createSupabaseHeaders({ prefer: 'resolution=merge-duplicates' }) : {},
            body: JSON.stringify({ update_key: 1, keywords: keywordsString })
          });
          
          if (!postResponse.ok) {
            throw new Error(`POST failed: HTTP ${postResponse.status}: ${postResponse.statusText}`);
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }
      
      if (this.utils.uiToast) {
        this.utils.uiToast(MESSAGES.SUCCESS.KEYWORDS_SAVED);
      }
    } catch (error) {
      log('error', 'saveKeywords: произошла ошибка', error);
      if (this.utils.safeAlert) {
        if (error.message.includes('авторизации')) {
          this.utils.safeAlert(error.message);
        } else {
          this.utils.safeAlert('Не удалось сохранить настройки. Проверьте подключение к интернету.');
        }
      }
    }
  }

  /**
   * Очистить все ключевые слова
   */
  async clearAllKeywords() {
    if (this.currentKeywords.length === 0) {
      if (this.utils.uiToast) {
        this.utils.uiToast('Нет ключевых слов для удаления');
      }
      return;
    }
    
    if (confirm(`Удалить все ${this.currentKeywords.length} ключевых слов?`)) {
      this.currentKeywords = [];
      this.displayKeywordTags();
      this.updateKeywordsCount();
      
      // Сохраняем пустой список в базу
      try {
        const response = await fetch(`${API_ENDPOINTS.SETTINGS}?update_key=eq.1`, {
          method: 'PATCH',
          headers: {
          'apikey': window.APP_CONFIG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.APP_CONFIG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
          body: JSON.stringify({ keywords: '' })
        });
        
        if (!response.ok && response.status !== 404) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        if (this.utils.uiToast) {
          this.utils.uiToast('Все ключевые слова удалены');
        }
      } catch (error) {
        log('error', 'Ошибка сохранения пустого списка:', error);
        if (this.utils.uiToast) {
          this.utils.uiToast('Ошибка сохранения изменений');
        }
      }
    }
  }

  /**
   * Добавить ключевые слова пачкой
   * @param {string} batchInput - Строка с ключевыми словами
   */
  addBatchKeywords(batchInput) {
    if (!batchInput || !batchInput.trim()) {
      return;
    }
    
    const keywords = batchInput
      .split(/[,\n\s]+/)
      .map(k => k.trim())
      .filter(k => k);
    
    if (keywords.length > 0) {
      keywords.forEach(keyword => {
        if (keyword) this.addKeyword(keyword);
      });
      
      if (this.utils.uiToast) {
        this.utils.uiToast(`Добавлено ${keywords.length} ключевых слов`);
      }
    }
  }

  /**
   * Загрузить пресет ключевых слов
   * @param {string} presetKey - Ключ пресета
   */
  loadPreset(presetKey) {
    const preset = KEYWORD_PRESETS[presetKey];
    if (!preset) {
      log('warn', `Пресет не найден: ${presetKey}`);
      return;
    }
    
    // Добавляем слова из пресета
    preset.forEach(keyword => {
      this.addKeyword(keyword);
    });
    
    if (this.utils.uiToast) {
      this.utils.uiToast(`Загружен пресет "${presetKey}" (${preset.length} слов)`);
    }
  }

  /**
   * Получить текущие ключевые слова
   * @returns {Array} Массив ключевых слов
   */
  getCurrentKeywords() {
    return [...this.currentKeywords];
  }

  /**
   * Установить ключевые слова
   * @param {Array} keywords - Массив ключевых слов
   */
  setKeywords(keywords) {
    this.currentKeywords = [...keywords];
    this.displayKeywordTags();
  }

  /**
   * Получить количество ключевых слов
   * @returns {number} Количество ключевых слов
   */
  getKeywordsCount() {
    return this.currentKeywords.length;
  }

  /**
   * Проверить, существует ли ключевое слово
   * @param {string} keyword - Ключевое слово для проверки
   * @returns {boolean} true если существует
   */
  hasKeyword(keyword) {
    const trimmed = keyword.trim().toLowerCase();
    return this.currentKeywords.map(k => k.toLowerCase()).includes(trimmed);
  }

  /**
   * Очистить таймер сохранения
   */
  cleanup() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
  }
}

/**
 * Создать экземпляр KeywordsManager
 * @returns {KeywordsManager} Экземпляр менеджера
 */
export function createKeywordsManager() {
  return new KeywordsManager();
}

/**
 * Экспорт по умолчанию
 */
export default KeywordsManager;
