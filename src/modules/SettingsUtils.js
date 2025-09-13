// SettingsUtils.js — общие утилиты и константы для настроек

/**
 * Константы для валидации каналов
 */
export const CHANNEL_VALIDATION = {
  MIN_LENGTH: 5,
  MAX_LENGTH: 32,
  PATTERN: /^[a-zA-Z0-9_]+$/
};

/**
 * API endpoints для настроек
 */
export const API_ENDPOINTS = {
  SETTINGS: `${window.APP_CONFIG?.SUPABASE_URL}/rest/v1/settings`,
  CHANNELS: `${window.APP_CONFIG?.SUPABASE_URL}/rest/v1/channels`,
  DEFAULT_CHANNELS: `${window.APP_CONFIG?.SUPABASE_URL}/rest/v1/default_channels`
};

/**
 * Сообщения об ошибках и успехе
 */
export const MESSAGES = {
  ERRORS: {
    CHANNEL_EXISTS: 'Такой канал уже существует в списке!',
    INVALID_FORMAT: `Неверный формат username. Используйте только буквы, цифры и подчеркивания (${CHANNEL_VALIDATION.MIN_LENGTH}-${CHANNEL_VALIDATION.MAX_LENGTH} символов).`,
    ADD_FAILED: 'Не удалось добавить канал',
    LOAD_FAILED: 'Не удалось загрузить каналы',
    DELETE_FAILED: 'Не удалось удалить канал',
    UPDATE_FAILED: 'Не удалось обновить статус'
  },
  SUCCESS: {
    CHANNEL_ADDED: 'Канал добавлен успешно!',
    CHANNEL_DELETED: 'Канал удалён',
    CHANNEL_TOGGLED: 'Канал включён',
    CHANNEL_DISABLED: 'Канал выключен',
    KEYWORDS_SAVED: 'Ключевые слова сохранены',
    DEFAULTS_LOADED: 'Стандартные каналы добавлены.',
    ALL_DELETED: 'Все каналы удалены.'
  }
};

/**
 * Пресеты ключевых слов
 */
export const KEYWORD_PRESETS = {
  video: ['монтаж', 'анимация', 'эффекты', 'цветокоррекция', 'видео'],
  design: ['дизайн', 'иллюстрация', 'типографика', 'брендинг', 'UI/UX'],
  development: ['программирование', 'веб', 'мобильные', 'API', 'база данных'],
  marketing: ['реклама', 'SMM', 'контент', 'аналитика', 'SEO']
};

/**
 * Получить конфигурацию приложения
 * @returns {Object} Конфигурация приложения
 */
export function getConfig() {
  return window.APP_CONFIG || {};
}

/**
 * Получить утилиты приложения
 * @returns {Object|null} Утилиты приложения или null если не найдены
 */
export function getUtils() {
  return window.utils || null;
}

/**
 * Проверить готовность зависимостей
 * @returns {boolean} true если все зависимости готовы
 */
export function checkDependencies() {
  const CFG = getConfig();
  const UTIL = getUtils();
  
  // Context7: Separate Query from Modifier - безопасная проверка для production
  if (!CFG || Object.keys(CFG).length === 0 || !UTIL) {
    console.error('SettingsUtils: CFG или UTIL не найдены');
    return false;
  }
  
  return true;
}

/**
 * Получить утилиту по имени
 * @param {string} name - Имя утилиты
 * @returns {Function|null} Функция утилиты или null
 */
export function getUtil(name) {
  const utils = getUtils();
  return utils[name] || null;
}

/**
 * Получить значение конфигурации
 * @param {string} key - Ключ конфигурации
 * @param {*} defaultValue - Значение по умолчанию
 * @returns {*} Значение конфигурации
 */
export function getConfigValue(key, defaultValue = null) {
  const config = getConfig();
  return config[key] !== undefined ? config[key] : defaultValue;
}

/**
 * Логирование с префиксом модуля
 * @param {string} level - Уровень логирования (log, warn, error)
 * @param {string} message - Сообщение для логирования
 * @param {*} data - Дополнительные данные
 */
export function log(level = 'log', message, data = null) {
  const prefix = '[SettingsUtils]';
  const fullMessage = `${prefix} ${message}`;
  
  if (data) {
    console[level](fullMessage, data);
  } else {
    console[level](fullMessage);
  }
}

/**
 * Проверить, что элемент существует в DOM
 * @param {string|Element} element - Элемент или селектор
 * @returns {boolean} true если элемент существует
 */
export function elementExists(element) {
  if (typeof element === 'string') {
    return document.querySelector(element) !== null;
  }
  return element && element instanceof Element;
}

/**
 * Безопасное получение элемента по ID
 * @param {string} id - ID элемента
 * @returns {Element|null} Элемент или null
 */
export function getElement(id) {
  return document.getElementById(id);
}

/**
 * Безопасное получение элемента по селектору
 * @param {string} selector - CSS селектор
 * @param {Element} parent - Родительский элемент (по умолчанию document)
 * @returns {Element|null} Элемент или null
 */
export function querySelector(selector, parent = document) {
  try {
    return parent.querySelector(selector);
  } catch (error) {
    log('error', `Ошибка поиска элемента: ${selector}`, error);
    return null;
  }
}

/**
 * Безопасное получение всех элементов по селектору
 * @param {string} selector - CSS селектор
 * @param {Element} parent - Родительский элемент (по умолчанию document)
 * @returns {NodeList|Array} Список элементов или пустой массив
 */
export function querySelectorAll(selector, parent = document) {
  try {
    return parent.querySelectorAll(selector);
  } catch (error) {
    log('error', `Ошибка поиска элементов: ${selector}`, error);
    return [];
  }
}

/**
 * Добавить обработчик события с проверкой существования элемента
 * @param {string|Element} element - Элемент или селектор
 * @param {string} event - Тип события
 * @param {Function} handler - Обработчик события
 * @param {Object} options - Опции события
 * @returns {boolean} true если обработчик добавлен
 */
export function addEventListener(element, event, handler, options = {}) {
  const targetElement = typeof element === 'string' ? getElement(element) : element;
  
  if (!targetElement) {
    log('warn', `Элемент не найден для добавления обработчика события: ${event}`);
    return false;
  }
  
  try {
    targetElement.addEventListener(event, handler, options);
    return true;
  } catch (error) {
    log('error', `Ошибка добавления обработчика события: ${event}`, error);
    return false;
  }
}

/**
 * Удалить обработчик события
 * @param {string|Element} element - Элемент или селектор
 * @param {string} event - Тип события
 * @param {Function} handler - Обработчик события
 * @param {Object} options - Опции события
 * @returns {boolean} true если обработчик удален
 */
export function removeEventListener(element, event, handler, options = {}) {
  const targetElement = typeof element === 'string' ? getElement(element) : element;
  
  if (!targetElement) {
    return false;
  }
  
  try {
    targetElement.removeEventListener(event, handler, options);
    return true;
  } catch (error) {
    log('error', `Ошибка удаления обработчика события: ${event}`, error);
    return false;
  }
}

/**
 * Создать элемент с атрибутами
 * @param {string} tagName - Имя тега
 * @param {Object} attributes - Атрибуты элемента
 * @param {string} textContent - Текстовое содержимое
 * @returns {Element} Созданный элемент
 */
export function createElement(tagName, attributes = {}, textContent = '') {
  const element = document.createElement(tagName);
  
  // Устанавливаем атрибуты
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = dataValue;
      });
    } else {
      element.setAttribute(key, value);
    }
  });
  
  // Устанавливаем текстовое содержимое
  if (textContent) {
    element.textContent = textContent;
  }
  
  return element;
}

/**
 * Проверить, что все необходимые элементы существуют
 * @param {Array} selectors - Массив селекторов для проверки
 * @returns {boolean} true если все элементы существуют
 */
export function validateElements(selectors) {
  const missingElements = selectors.filter(selector => !elementExists(selector));
  
  if (missingElements.length > 0) {
    log('error', `Отсутствуют элементы: ${missingElements.join(', ')}`);
    return false;
  }
  
  return true;
}

/**
 * Получить все необходимые элементы по селекторам
 * @param {Object} selectors - Объект с селекторами
 * @returns {Object} Объект с элементами
 */
export function getElements(selectors) {
  const elements = {};
  
  Object.entries(selectors).forEach(([key, selector]) => {
    elements[key] = getElement(selector);
  });
  
  return elements;
}

/**
 * Экспорт по умолчанию
 */
export default {
  CHANNEL_VALIDATION,
  API_ENDPOINTS,
  MESSAGES,
  KEYWORD_PRESETS,
  getConfig,
  getUtils,
  checkDependencies,
  getUtil,
  getConfigValue,
  log,
  elementExists,
  getElement,
  querySelector,
  querySelectorAll,
  addEventListener,
  removeEventListener,
  createElement,
  validateElements,
  getElements
};
