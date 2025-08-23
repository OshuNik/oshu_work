// SettingsUI.js — UI логика и обработчики событий

import { 
  getElement,
  addEventListener,
  removeEventListener,
  log
} from './SettingsUtils.js';

/**
 * Класс для управления UI настроек
 */
export class SettingsUI {
  constructor() {
    this.tabButtons = null;
    this.tabContents = null;
    this.burgerMenuBtn = null;
    this.sidebar = null;
    this.sidebarOverlay = null;
    this.sidebarCloseBtn = null;
    
    this.keywordsInput = null;
    this.channelsInput = null;
    
    this.eventHandlers = new Map();
    
    this.init();
  }

  /**
   * Инициализация UI
   */
  init() {
    this.getElements();
    this.setupEventHandlers();
    this.initializeState();
    
    log('log', 'SettingsUI инициализирован');
  }

  /**
   * Получить все необходимые DOM элементы
   */
  getElements() {
    // Вкладки настроек
    this.tabButtons = document.querySelectorAll('.sidebar-tab-button');
    this.tabContents = document.querySelectorAll('.settings-tab-content');
    
    // Бургер меню
    this.burgerMenuBtn = getElement('burger-menu-btn');
    this.sidebar = getElement('settings-sidebar');
    this.sidebarOverlay = getElement('sidebar-overlay');
    this.sidebarCloseBtn = getElement('sidebar-close-btn');
    
    // Поля ввода
    this.keywordsInput = getElement('new-keyword-input');
    this.channelsInput = getElement('channel-input');
  }

  /**
   * Настроить обработчики событий
   */
  setupEventHandlers() {
    this.setupTabHandlers();
    this.setupBurgerMenuHandlers();
    this.setupInputHandlers();
    this.setupButtonHandlers();
  }

  /**
   * Настроить обработчики вкладок
   */
  setupTabHandlers() {
    this.tabButtons.forEach(button => {
      const handler = () => {
        this.tabButtons.forEach(btn => btn.classList.remove('active'));
        this.tabContents.forEach(content => content.classList.remove('active'));
        
        button.classList.add('active');
        const targetContent = getElement(button.dataset.target);
        if (targetContent) {
          targetContent.classList.add('active');
        }
      };
      
      button.addEventListener('click', handler);
      this.eventHandlers.set(`tab-${button.id}`, { element: button, event: 'click', handler });
    });
  }

  /**
   * Настроить обработчики бургер меню
   */
  setupBurgerMenuHandlers() {
    if (this.burgerMenuBtn) {
      const openHandler = () => this.openSidebar();
      this.burgerMenuBtn.addEventListener('click', openHandler);
      this.eventHandlers.set('burger-open', { element: this.burgerMenuBtn, event: 'click', handler: openHandler });
    }
    
    if (this.sidebarCloseBtn) {
      const closeHandler = () => this.closeSidebar();
      this.sidebarCloseBtn.addEventListener('click', closeHandler);
      this.eventHandlers.set('sidebar-close', { element: this.sidebarCloseBtn, event: 'click', handler: closeHandler });
    }
    
    if (this.sidebarOverlay) {
      const overlayHandler = () => this.closeSidebar();
      this.sidebarOverlay.addEventListener('click', overlayHandler);
      this.eventHandlers.set('sidebar-overlay', { element: this.sidebarOverlay, event: 'click', handler: overlayHandler });
    }
  }

  /**
   * Настроить обработчики полей ввода
   */
  setupInputHandlers() {
    // Обработчики для поля ключевых слов
    if (this.keywordsInput) {
      const inputHandler = () => this.updateKeywordsInputState();
      const focusHandler = () => this.updateKeywordsInputState();
      
      this.keywordsInput.addEventListener('input', inputHandler);
      this.keywordsInput.addEventListener('focus', focusHandler);
      
      this.eventHandlers.set('keywords-input', { element: this.keywordsInput, event: 'input', handler: inputHandler });
      this.eventHandlers.set('keywords-focus', { element: this.keywordsInput, event: 'focus', handler: focusHandler });
    }
    
    // Обработчики для поля каналов
    if (this.channelsInput) {
      const inputHandler = () => this.updateChannelsInputState();
      const focusHandler = () => this.updateChannelsInputState();
      const keypressHandler = (e) => this.handleChannelsKeypress(e);
      
      this.channelsInput.addEventListener('input', inputHandler);
      this.channelsInput.addEventListener('focus', focusHandler);
      this.channelsInput.addEventListener('keypress', keypressHandler);
      
      this.eventHandlers.set('channels-input', { element: this.channelsInput, event: 'input', handler: inputHandler });
      this.eventHandlers.set('channels-focus', { element: this.channelsInput, event: 'focus', handler: focusHandler });
      this.eventHandlers.set('channels-keypress', { element: this.channelsInput, event: 'keypress', handler: keypressHandler });
    }
  }

  /**
   * Настроить обработчики кнопок
   */
  setupButtonHandlers() {
    // Кнопка очистки ключевых слов
    const keywordsClearBtn = getElement('keywords-clear-button');
    if (keywordsClearBtn) {
      const handler = () => this.clearKeywordsInput();
      keywordsClearBtn.addEventListener('click', handler);
      this.eventHandlers.set('keywords-clear', { element: keywordsClearBtn, event: 'click', handler });
    }
    
    // Кнопка очистки каналов
    const channelsClearBtn = getElement('channels-clear-button');
    if (channelsClearBtn) {
      const handler = () => this.clearChannelsInput();
      channelsClearBtn.addEventListener('click', handler);
      this.eventHandlers.set('channels-clear', { element: channelsClearBtn, event: 'click', handler });
    }
    
    // Кнопка добавления ключевых слов
    const addKeywordBtn = getElement('add-keyword-btn');
    if (addKeywordBtn) {
      const handler = () => this.handleAddKeyword();
      addKeywordBtn.addEventListener('click', handler);
      this.eventHandlers.set('add-keyword', { element: addKeywordBtn, event: 'click', handler });
    }
    
    // Кнопка добавления канала
    const addChannelBtn = getElement('add-channel-btn');
    if (addChannelBtn) {
      const handler = () => this.handleAddChannel();
      addChannelBtn.addEventListener('click', handler);
      this.eventHandlers.set('add-channel', { element: addChannelBtn, event: 'click', handler });
    }
    
    // Кнопка загрузки стандартных ключевых слов
    const loadDefaultsKeywordsBtn = getElement('load-defaults-keywords-btn');
    if (loadDefaultsKeywordsBtn) {
      const handler = () => this.handleLoadDefaultsKeywords();
      loadDefaultsKeywordsBtn.addEventListener('click', handler);
      this.eventHandlers.set('load-defaults-keywords', { element: loadDefaultsKeywordsBtn, event: 'click', handler });
    }
    
    // Кнопка загрузки стандартных каналов
    const loadDefaultsChannelsBtn = getElement('load-defaults-channels-btn');
    if (loadDefaultsChannelsBtn) {
      const handler = () => this.handleLoadDefaultsChannels();
      loadDefaultsChannelsBtn.addEventListener('click', handler);
      this.eventHandlers.set('load-defaults-channels', { element: loadDefaultsChannelsBtn, event: 'click', handler });
    }
    
    // Кнопка удаления всех ключевых слов
    const clearAllKeywordsBtn = getElement('clear-all-keywords-btn');
    if (clearAllKeywordsBtn) {
      const handler = () => this.handleClearAllKeywords();
      clearAllKeywordsBtn.addEventListener('click', handler);
      this.eventHandlers.set('clear-all-keywords', { element: clearAllKeywordsBtn, event: 'click', handler });
    }
    
    // Кнопка удаления всех каналов
    const clearAllChannelsBtn = getElement('clear-all-channels-btn');
    if (clearAllChannelsBtn) {
      const handler = () => this.handleClearAllChannels();
      clearAllChannelsBtn.addEventListener('click', handler);
      this.eventHandlers.set('clear-all-channels', { element: clearAllChannelsBtn, event: 'click', handler });
    }
    
    // Кнопка добавления ключевых слов пачкой
    const addBatchBtn = getElement('add-batch-btn');
    if (addBatchBtn) {
      const handler = () => this.handleAddBatchKeywords();
      addBatchBtn.addEventListener('click', handler);
      this.eventHandlers.set('add-batch-keywords', { element: addBatchBtn, event: 'click', handler });
    }
  }

  /**
   * Инициализировать начальное состояние
   */
  initializeState() {
    // Обновляем состояние крестиков
    setTimeout(() => {
      this.updateKeywordsInputState();
      this.updateChannelsInputState();
    }, 100);
    
    // Настраиваем обработчики для кликабельных примеров
    this.setupExampleHandlers();
  }

  /**
   * Настроить обработчики для кликабельных примеров
   */
  setupExampleHandlers() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('example-btn')) {
        const example = e.target.dataset.example;
        if (this.channelsInput && example) {
          this.channelsInput.value = example;
          this.channelsInput.focus();
          this.updateChannelsInputState();
        }
      }
    });
  }

  /**
   * Открыть боковое меню
   */
  openSidebar() {
    if (this.sidebar && this.sidebarOverlay) {
      this.sidebar.classList.add('active');
      this.sidebarOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  /**
   * Закрыть боковое меню
   */
  closeSidebar() {
    if (this.sidebar && this.sidebarOverlay) {
      this.sidebar.classList.remove('active');
      this.sidebarOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  /**
   * Обновить состояние крестика для поля ключевых слов
   */
  updateKeywordsInputState() {
    const keywordsInputWrapper = document.querySelector('.keywords-input-wrapper');
    if (keywordsInputWrapper && this.keywordsInput) {
      const hasText = this.keywordsInput.value.length > 0;
      keywordsInputWrapper.classList.toggle('has-text', hasText);
    }
  }

  /**
   * Обновить состояние крестика для поля каналов
   */
  updateChannelsInputState() {
    const channelsInputWrapper = document.querySelector('.channels-input-wrapper');
    if (channelsInputWrapper && this.channelsInput) {
      const hasText = this.channelsInput.value.length > 0;
      channelsInputWrapper.classList.toggle('has-text', hasText);
    }
  }

  /**
   * Очистить поле ввода ключевых слов
   */
  clearKeywordsInput() {
    if (this.keywordsInput) {
      this.keywordsInput.value = '';
      this.keywordsInput.focus();
      this.updateKeywordsInputState();
    }
  }

  /**
   * Очистить поле ввода каналов
   */
  clearChannelsInput() {
    if (this.channelsInput) {
      this.channelsInput.value = '';
      this.channelsInput.focus();
      this.updateChannelsInputState();
    }
  }

  /**
   * Обработать нажатие Enter в поле каналов
   */
  handleChannelsKeypress(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.handleAddChannel();
    }
  }

  /**
   * Обработать добавление ключевого слова
   */
  handleAddKeyword() {
    if (!this.keywordsInput) return;
    
    const value = this.keywordsInput.value.trim();
    if (value) {
      // Эмитируем событие для KeywordsManager с поддержкой запятых
      const event = new CustomEvent('addKeywords', { detail: { value } });
      document.dispatchEvent(event);
      
      this.clearKeywordsInput();
    }
  }

  /**
   * Обработать добавление канала
   */
  handleAddChannel() {
    if (!this.channelsInput) return;
    
    const value = this.channelsInput.value.trim();
    if (value) {
      // Эмитируем событие для ChannelsManager
      const event = new CustomEvent('addChannel', { detail: { value } });
      document.dispatchEvent(event);
      
      this.clearChannelsInput();
    }
  }

  /**
   * Обработать загрузку стандартных ключевых слов
   */
  handleLoadDefaultsKeywords() {
    // Эмитируем событие для KeywordsManager
    const event = new CustomEvent('loadDefaultsKeywords');
    document.dispatchEvent(event);
  }

  /**
   * Обработать загрузку стандартных каналов
   */
  handleLoadDefaultsChannels() {
    // Эмитируем событие для ChannelsManager
    const event = new CustomEvent('loadDefaultsChannels');
    document.dispatchEvent(event);
  }

  /**
   * Обработать удаление всех ключевых слов
   */
  handleClearAllKeywords() {
    // Эмитируем событие для KeywordsManager
    const event = new CustomEvent('clearAllKeywords');
    document.dispatchEvent(event);
  }

  /**
   * Обработать удаление всех каналов
   */
  handleClearAllChannels() {
    // Эмитируем событие для ChannelsManager
    const event = new CustomEvent('deleteAllChannels');
    document.dispatchEvent(event);
  }

  /**
   * Обработать удаление всех каналов
   */
  handleDeleteAllChannels() {
    // Эмитируем событие для ChannelsManager
    const event = new CustomEvent('deleteAllChannels');
    document.dispatchEvent(event);
  }

  /**
   * Обработать добавление ключевых слов пачкой
   */
  handleAddBatchKeywords() {
    const batchInput = getElement('batch-keywords-input');
    if (batchInput && batchInput.value.trim()) {
      // Эмитируем событие для KeywordsManager
      const event = new CustomEvent('addBatchKeywords', { detail: { value: batchInput.value } });
      document.dispatchEvent(event);
      
      batchInput.value = '';
    }
  }

  /**
   * Переключить вкладку
   * @param {string} tabId - ID вкладки для переключения
   */
  switchTab(tabId) {
    const targetButton = Array.from(this.tabButtons).find(btn => btn.id === tabId);
    if (targetButton) {
      targetButton.click();
    }
  }

  /**
   * Получить активную вкладку
   * @returns {string|null} ID активной вкладки
   */
  getActiveTab() {
    const activeButton = Array.from(this.tabButtons).find(btn => btn.classList.contains('active'));
    return activeButton ? activeButton.id : null;
  }

  /**
   * Показать/скрыть индикатор загрузки
   * @param {boolean} show - Показать или скрыть
   * @param {string} message - Сообщение загрузки
   */
  showLoading(show, message = 'Загрузка...') {
    const loader = getElement('settings-loader');
    if (loader) {
      if (show) {
        loader.textContent = message;
        loader.classList.remove('hidden');
      } else {
        loader.classList.add('hidden');
      }
    }
  }

  /**
   * Показать сообщение об ошибке
   * @param {string} message - Сообщение об ошибке
   * @param {string} type - Тип сообщения (error, warning, info)
   */
  showMessage(message, type = 'info') {
    // Создаем элемент сообщения
    const messageElement = document.createElement('div');
    messageElement.className = `settings-message settings-message-${type}`;
    messageElement.textContent = message;
    
    // Добавляем в контейнер сообщений
    const container = getElement('settings-messages') || document.body;
    container.appendChild(messageElement);
    
    // Автоматически удаляем через 5 секунд
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.remove();
      }
    }, 5000);
  }

  /**
   * Обновить счетчик элементов
   * @param {string} type - Тип элементов (keywords, channels)
   * @param {number} count - Количество элементов
   * @param {boolean} withAnimation - Показывать анимацию от 0
   */
  updateCounter(type, count) {
    const counterElement = getElement(`${type}-count`);
    if (!counterElement) return;
    
    counterElement.textContent = count.toString();
    counterElement.classList.add('updating');
    setTimeout(() => counterElement.classList.remove('updating'), 200);
  }

  /**
   * Обновить состояние кнопок
   * @param {string} type - Тип кнопок (keywords, channels)
   * @param {Object} states - Состояния кнопок
   */
  updateButtonStates(type, states) {
    Object.entries(states).forEach(([buttonId, state]) => {
      const button = getElement(buttonId);
      if (button) {
        button.disabled = !state.enabled;
        if (state.visible !== undefined) {
          button.style.display = state.visible ? '' : 'none';
        }
      }
    });
  }

  /**
   * Очистить все сообщения
   */
  clearMessages() {
    const messages = document.querySelectorAll('.settings-message');
    messages.forEach(msg => msg.remove());
  }

  /**
   * Очистка ресурсов
   */
  cleanup() {
    // Удаляем все обработчики событий
    this.eventHandlers.forEach(({ element, event, handler }) => {
      if (element && element.removeEventListener) {
        element.removeEventListener(event, handler);
      }
    });
    
    this.eventHandlers.clear();
    
    // Закрываем боковое меню
    this.closeSidebar();
    
    // Очищаем сообщения
    this.clearMessages();
  }
}

/**
 * Создать экземпляр SettingsUI
 * @returns {SettingsUI} Экземпляр UI менеджера
 */
export function createSettingsUI() {
  return new SettingsUI();
}

/**
 * Экспорт по умолчанию
 */
export default SettingsUI;
