// ChannelsManager.js — управление каналами

import { 
  CHANNEL_VALIDATION, 
  API_ENDPOINTS, 
  MESSAGES,
  getUtil,
  log,
  getElement,
  createElement
} from './SettingsUtils.js';

/**
 * Класс для управления каналами
 */
export class ChannelsManager {
  constructor() {
    this.channels = [];
    this.selectedChannels = new Set();
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
      showCustomConfirm: getUtil('showCustomConfirm'),
      createSupabaseHeaders: getUtil('createSupabaseHeaders'),
      escapeHtml: getUtil('escapeHtml')
    };

    // Получаем DOM элементы
    this.container = getElement('channels-list');
    this.input = getElement('channel-input');

    if (!this.container) {
      log('error', 'Элемент channels-list не найден');
      return;
    }

    log('log', 'ChannelsManager инициализирован');
  }

  /**
   * Валидирует и форматирует ID канала
   * @param {string} input - Входная строка (username, t.me ссылка или @username)
   * @returns {string|null} Отформатированный channelId или null при ошибке
   */
  validateAndFormatChannelId(input) {
    if (!input) return null;
    
    let channelId = input.trim();
    
    // Преобразование t.me ссылок
    if (channelId.includes('t.me/')) {
      channelId = '@' + channelId.split('t.me/')[1].split('/')[0];
    }
    
    // Добавление @ если отсутствует
    if (!channelId.startsWith('@')) channelId = '@' + channelId;
    
    // Валидация username
    const username = channelId.substring(1);
    if (!CHANNEL_VALIDATION.PATTERN.test(username) || 
        username.length < CHANNEL_VALIDATION.MIN_LENGTH || 
        username.length > CHANNEL_VALIDATION.MAX_LENGTH) {
      if (this.utils.safeAlert) {
        this.utils.safeAlert(MESSAGES.ERRORS.INVALID_FORMAT);
      }
      return null;
    }
    
    return channelId;
  }

  /**
   * Проверяет существование канала в базе данных
   * @param {string} channelId - ID канала для проверки
   * @returns {Promise<boolean>} true если канал существует, false если нет
   */
  async isChannelExists(channelId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.CHANNELS}?channel_id=eq.${encodeURIComponent(channelId)}&select=id`, {
        headers: {
          'apikey': window.APP_CONFIG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.APP_CONFIG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const existingChannels = await response.json();
        return existingChannels.length > 0;
      } else {
        log('warn', '⚠️ Ошибка проверки дубликатов:', response.status, response.statusText);
        return false;
      }
    } catch (error) {
      log('error', 'Ошибка проверки существования канала:', error);
      return false;
    }
  }

  /**
   * Создает новый канал в базе данных и отображает его в интерфейсе
   * @param {string} channelId - ID канала для создания
   * @returns {Promise<Object>} Созданный объект канала
   */
  async createChannel(channelId) {
    log('log', '[DEBUG] Создание канала:', channelId);
    
    const newChannelData = { 
      channel_id: channelId, 
      channel_title: channelId, 
      is_enabled: true 
    };
    
    log('log', '[DEBUG] Отправляемые данные:', newChannelData);
    log('log', '[DEBUG] API URL:', API_ENDPOINTS.CHANNELS);
    
    const response = await fetch(API_ENDPOINTS.CHANNELS, {
      method: 'POST',
      headers: {
        'apikey': window.APP_CONFIG?.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${window.APP_CONFIG?.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(newChannelData)
    });
    
    log('log', '[DEBUG] Ответ сервера:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      log('error', '[DEBUG] Ошибка API:', errorText);
      throw new Error(`Ошибка API: ${response.status} ${response.statusText}. ${errorText}`);
    }
    
    const data = await response.json();
    log('log', '[DEBUG] Полученные данные:', data);
    
    if (data && data.length > 0) {
      this.renderChannel(data[0]);
      if (this.input) this.input.value = '';
      if (this.utils.uiToast) {
        this.utils.uiToast(MESSAGES.SUCCESS.CHANNEL_ADDED);
      }
      log('log', '[DEBUG] Канал успешно создан:', data[0]);
      return data[0];
    } else {
      log('error', '[DEBUG] API не вернул данные о канале');
      throw new Error('API не вернул данные о добавленном канале');
    }
  }

  /**
   * Добавить канал
   * @param {string} channelId - ID канала
   * @returns {Promise<boolean>} true если добавлен успешно
   */
  async addChannel(channelId) {
    try {
      // Проверяем существование
      const exists = await this.isChannelExists(channelId);
      if (exists) {
        if (this.utils.safeAlert) {
          this.utils.safeAlert(MESSAGES.ERRORS.CHANNEL_EXISTS);
        }
        return false;
      }

      // Создаем канал
      await this.createChannel(channelId);
      return true;
    } catch (error) {
      log('error', 'Ошибка добавления канала:', error);
      if (this.utils.safeAlert) {
        this.utils.safeAlert(MESSAGES.ERRORS.ADD_FAILED);
      }
      return false;
    }
  }

  /**
   * Рендерит канал в интерфейсе
   * @param {Object} channel - Объект канала
   */
  renderChannel(channel) {
    const channelItem = createElement('div', {
      className: 'channel-item',
      dataset: { dbId: channel.id }
    });
    
    // Получаем @username из channel_id - убираем все лишнее
    let username = channel.channel_id || '';
    if (username.includes('t.me/')) {
      username = '@' + username.split('t.me/')[1].split('/')[0];
    } else if (!username.startsWith('@')) {
      username = '@' + username.replace('@', '');
    }
    
    // Создаем кликабельную ссылку с правильным @username
    const titleLink = createElement('a', { 
      className: 'channel-item-title',
      href: `https://t.me/${username.replace('@', '')}`,
      target: '_blank',
      rel: 'noopener noreferrer'
    });
    const escapedTitle = this.utils.escapeHtml ? this.utils.escapeHtml(username) : username;
    titleLink.textContent = escapedTitle;
    
    // Контейнер для правых кнопок
    const rightControls = createElement('div', {
      className: 'channel-controls'
    });
    
    // Слайдер-переключатель включения/отключения
    const toggleWrapper = createElement('label', {
      className: 'toggle-switch'
    });
    
    const toggleInput = createElement('input', {
      type: 'checkbox',
      className: 'toggle-input',
      checked: channel.is_enabled || false
    });
    
    const toggleSlider = createElement('span', {
      className: 'toggle-slider'
    });
    
    toggleWrapper.appendChild(toggleInput);
    toggleWrapper.appendChild(toggleSlider);
    
    // Кнопка удаления
    const deleteButton = createElement('button', { className: 'channel-item-delete' });
    deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    
    // Обработчик переключения
    const toggleHandler = async (e) => {
      const isEnabled = e.target.checked;
      const dbId = channelItem.dataset.dbId;
      
      try {
        const response = await fetch(`${API_ENDPOINTS.CHANNELS}?id=eq.${dbId}`, {
          method: 'PATCH',
          headers: {
            'apikey': window.APP_CONFIG?.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${window.APP_CONFIG?.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ is_enabled: isEnabled })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Обновляем локальные данные
        const channelIndex = this.channels.findIndex(ch => ch.id.toString() === dbId);
        if (channelIndex !== -1) {
          this.channels[channelIndex].is_enabled = isEnabled;
        }
        
        log('log', `Канал ${channel.channel_id} ${isEnabled ? 'включен' : 'отключен'}`);
      } catch (error) {
        log('error', 'Ошибка переключения канала:', error);
        // Возвращаем состояние переключателя обратно
        e.target.checked = !isEnabled;
        if (this.utils.safeAlert) {
          this.utils.safeAlert('Ошибка переключения канала');
        }
      }
    };
    
    // Обработчик удаления
    const deleteHandler = async () => {
      const dbId = channelItem.dataset.dbId;
      log('log', '[DEBUG] Удаление канала:', { dbId, channel_id: channel.channel_id });
      
      if (!dbId) {
        log('error', '[DEBUG] Отсутствует dbId для удаления канала:', channel.channel_id);
        return;
      }
      
      let ok = false;
      if (this.utils.showCustomConfirm) {
        ok = await this.utils.showCustomConfirm('Удалить этот канал?');
      } else {
        ok = confirm('Удалить этот канал?');
      }
      
      if (!ok) return;
      
      channelItem.style.opacity = '0.5';
      try {
        const deleteUrl = `${API_ENDPOINTS.CHANNELS}?id=eq.${dbId}`;
        log('log', '[DEBUG] URL удаления:', deleteUrl);
        
        const response = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
          'apikey': window.APP_CONFIG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.APP_CONFIG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
        });
        
        log('log', '[DEBUG] Ответ удаления:', response.status, response.statusText);
        
        if (!response.ok) {
          const errorText = await response.text();
          log('error', '[DEBUG] Ошибка удаления:', errorText);
          throw new Error(`Ошибка ответа сети: ${response.status} ${errorText}`);
        }
        
        log('log', '[DEBUG] Канал успешно удален из БД');
        channelItem.remove();
        if (this.utils.uiToast) {
          this.utils.uiToast(MESSAGES.SUCCESS.CHANNEL_DELETED);
        }
        // Обновляем состояние кнопки удаления выбранных
        this.updateDeleteSelectedButton();
      } catch (error) {
        log('error', '[DEBUG] Ошибка удаления канала:', error);
        if (this.utils.safeAlert) {
          this.utils.safeAlert(MESSAGES.ERRORS.DELETE_FAILED);
        }
        channelItem.style.opacity = '1';
      }
    };
    
    // Собираем правые элементы управления
    rightControls.appendChild(toggleWrapper);
    rightControls.appendChild(deleteButton);
    
    // Собираем итоговый элемент канала
    channelItem.appendChild(titleLink);
    channelItem.appendChild(rightControls);
    
    // Добавляем обработчики
    toggleInput.addEventListener('change', toggleHandler);
    deleteButton.addEventListener('click', deleteHandler);
    
    // Добавляем в контейнер
    this.container.appendChild(channelItem);
    
    // Сохраняем ссылки на обработчики для cleanup
    channelItem._handlers = { toggle: toggleHandler, delete: deleteHandler };
  }

  /**
   * Загрузить каналы из базы данных
   */
  async loadChannels() {
    if (!this.container) {
      log('error', 'loadChannels: элемент channels-list не найден');
      return;
    }
    
    this.container.innerHTML = '<div class="loading-indicator">Загрузка каналов...</div>';
    
    try {
      const response = await fetch(API_ENDPOINTS.CHANNELS, {
        headers: {
          'apikey': window.APP_CONFIG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.APP_CONFIG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Ошибка авторизации: недействительный API ключ.');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      this.channels = data || [];
      
      // Очищаем контейнер
      this.container.innerHTML = '';
      
      // Рендерим каналы
      this.channels.forEach(channel => {
        this.renderChannel(channel);
      });
      
      // Обновляем счетчик
      this.updateChannelsCount();
      
      log('log', `Загружено ${this.channels.length} каналов`);
    } catch (error) {
      log('error', 'Ошибка загрузки каналов:', error);
      this.container.innerHTML = '<div class="loading-indicator error-indicator">Ошибка загрузки каналов</div>';
    }
  }

  /**
   * Обновить счетчик каналов
   */
  updateChannelsCount() {
    const countElement = getElement('channels-count');
    if (countElement) {
      countElement.textContent = this.channels.length.toString();
    }
  }

  /**
   * Обновить состояние кнопки удаления выбранных
   */
  updateDeleteSelectedButton() {
    const deleteSelectedBtn = getElement('delete-selected-btn');
    if (deleteSelectedBtn) {
      deleteSelectedBtn.disabled = this.selectedChannels.size === 0;
    }
  }

  /**
   * Удалить выбранные каналы
   */
  async deleteSelectedChannels() {
    if (this.selectedChannels.size === 0) {
      if (this.utils.uiToast) {
        this.utils.uiToast('Нет выбранных каналов для удаления');
      }
      return;
    }
    
    let confirmMessage = 'Удалить выбранные каналы?';
    if (this.selectedChannels.size === 1) {
      confirmMessage = 'Удалить выбранный канал?';
    }
    
    let ok = false;
    if (this.utils.showCustomConfirm) {
      ok = await this.utils.showCustomConfirm(confirmMessage);
    } else {
      ok = confirm(confirmMessage);
    }
    
    if (!ok) return;
    
    const selectedIds = Array.from(this.selectedChannels);
    let deletedCount = 0;
    
    for (const id of selectedIds) {
      try {
        const response = await fetch(`${API_ENDPOINTS.CHANNELS}?id=eq.${id}`, {
          method: 'DELETE',
          headers: {
          'apikey': window.APP_CONFIG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.APP_CONFIG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
        });
        
        if (response.ok) {
          deletedCount++;
          this.selectedChannels.delete(id);
        }
      } catch (error) {
        log('error', `Ошибка удаления канала ${id}:`, error);
      }
    }
    
    if (deletedCount > 0) {
      // Перезагружаем каналы для обновления UI
      await this.loadChannels();
      
      if (this.utils.uiToast) {
        this.utils.uiToast(`Удалено ${deletedCount} каналов`);
      }
    }
  }

  /**
   * Удалить все каналы
   */
  async deleteAllChannels() {
    if (this.channels.length === 0) {
      if (this.utils.uiToast) {
        this.utils.uiToast('Нет каналов для удаления');
      }
      return;
    }
    
    let ok = false;
    if (this.utils.showCustomConfirm) {
      ok = await this.utils.showCustomConfirm(`Удалить все ${this.channels.length} каналов?`);
    } else {
      ok = confirm(`Удалить все ${this.channels.length} каналов?`);
    }
    
    if (!ok) return;
    
    try {
      // Для удаления всех записей в Supabase нужно использовать фильтр
      // Используем id>0 чтобы удалить все записи (так как id всегда больше 0)
      const response = await fetch(`${API_ENDPOINTS.CHANNELS}?id=gt.0`, {
        method: 'DELETE',
        headers: {
          'apikey': window.APP_CONFIG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.APP_CONFIG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        this.channels = [];
        this.selectedChannels.clear();
        this.container.innerHTML = '<div class="loading-indicator">-- каналы не заданы --</div>';
        this.updateChannelsCount();
        this.updateDeleteSelectedButton();
        
        if (this.utils.uiToast) {
          this.utils.uiToast(MESSAGES.SUCCESS.ALL_DELETED);
        }
      } else {
        const errorText = await response.text();
        log('error', 'Ошибка DELETE запроса:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}. ${errorText}`);
      }
    } catch (error) {
      log('error', 'Ошибка удаления всех каналов:', error);
      if (this.utils.safeAlert) {
        this.utils.safeAlert('Ошибка удаления каналов');
      }
    }
  }

  /**
   * Загрузить стандартные каналы
   */
  async loadDefaultChannels() {
    try {
      const response = await fetch(API_ENDPOINTS.DEFAULT_CHANNELS, {
        headers: {
          'apikey': window.APP_CONFIG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.APP_CONFIG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const defaultChannels = await response.json();
      
      // Проверяем существующие каналы одним запросом
      const existingResponse = await fetch(API_ENDPOINTS.CHANNELS + '?select=channel_id', {
        headers: {
          'apikey': window.APP_CONFIG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.APP_CONFIG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      const existingChannels = existingResponse.ok ? await existingResponse.json() : [];
      const existingIds = new Set(existingChannels.map(ch => ch.channel_id));
      
      // Фильтруем только новые каналы
      const newChannels = defaultChannels.filter(ch => !existingIds.has(ch.channel_id));
      
      if (newChannels.length === 0) {
        if (this.utils.uiToast) {
          this.utils.uiToast('Все стандартные каналы уже добавлены');
        }
        return;
      }
      
      // Подготавливаем данные для batch-создания
      const channelsData = newChannels.map(ch => ({
        channel_id: ch.channel_id,
        channel_title: ch.channel_id,
        is_enabled: true
      }));
      
      // Создаем все каналы одним batch-запросом
      const createResponse = await fetch(API_ENDPOINTS.CHANNELS, {
        method: 'POST',
        headers: {
          'apikey': window.APP_CONFIG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.APP_CONFIG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(channelsData)
      });
      
      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`HTTP ${createResponse.status}: ${errorText}`);
      }
      
      const createdChannels = await createResponse.json();
      log('log', `Batch-создано ${createdChannels.length} каналов`);
      
      // Показываем сообщение
      if (this.utils.uiToast) {
        const existingCount = defaultChannels.length - newChannels.length;
        if (existingCount > 0) {
          this.utils.uiToast(`Добавлено ${createdChannels.length} каналов, ${existingCount} уже существовали`);
        } else {
          this.utils.uiToast(`Добавлено ${createdChannels.length} стандартных каналов`);
        }
      }
      
      // Перезагружаем список каналов
      await this.loadChannels();
    } catch (error) {
      log('error', 'Ошибка загрузки стандартных каналов:', error);
      if (this.utils.safeAlert) {
        this.utils.safeAlert('Ошибка загрузки стандартных каналов');
      }
    }
  }

  /**
   * Получить все каналы
   * @returns {Array} Массив каналов
   */
  getChannels() {
    return [...this.channels];
  }

  /**
   * Получить выбранные каналы
   * @returns {Array} Массив выбранных каналов
   */
  getSelectedChannels() {
    return Array.from(this.selectedChannels);
  }

  /**
   * Очистить выбор каналов
   */
  clearSelection() {
    this.selectedChannels.clear();
    this.updateDeleteSelectedButton();
    
    // Убираем класс selected со всех элементов
    const selectedElements = this.container.querySelectorAll('.channel-item.selected');
    selectedElements.forEach(element => {
      element.classList.remove('selected');
    });
  }

  /**
   * Очистка ресурсов
   */
  cleanup() {
    // Удаляем обработчики событий
    this.container.querySelectorAll('.channel-item').forEach(item => {
      if (item._handlers) {
        const { select, toggle, delete: deleteHandler } = item._handlers;
        const selectInput = item.querySelector('.channel-select-checkbox');
        const toggleInput = item.querySelector('input[type="checkbox"]:not(.channel-select-checkbox)');
        const deleteButton = item.querySelector('.channel-item-delete');
        
        if (selectInput && select) {
          selectInput.removeEventListener('change', select);
        }
        if (toggleInput && toggle) {
          toggleInput.removeEventListener('change', toggle);
        }
        if (deleteButton && deleteHandler) {
          deleteButton.removeEventListener('click', deleteHandler);
        }
      }
    });
    
    this.selectedChannels.clear();
  }
}

/**
 * Создать экземпляр ChannelsManager
 * @returns {ChannelsManager} Экземпляр менеджера
 */
export function createChannelsManager() {
  return new ChannelsManager();
}

/**
 * Экспорт по умолчанию
 */
export default ChannelsManager;
