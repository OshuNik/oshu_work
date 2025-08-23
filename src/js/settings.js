// settings.js — страница настроек
(function() {
  'use strict';

  const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
  if (tg && tg.expand) tg.expand();

  const CFG = window.APP_CONFIG;
  const UTIL = window.utils;

  if (!CFG || !UTIL) {
    alert("Критическая ошибка: Не найден config.js или utils.js!");
    console.error('settings.js: CFG или UTIL не найдены');
    return;
  }

  const { uiToast, safeAlert, showCustomConfirm, createSupabaseHeaders, escapeHtml } = UTIL;

  // Константы для валидации и конфигурации
  const CHANNEL_VALIDATION = {
    MIN_LENGTH: 5,
    MAX_LENGTH: 32,
    PATTERN: /^[a-zA-Z0-9_]+$/
  };

  const API_ENDPOINTS = {
    SETTINGS: `${CFG.SUPABASE_URL}/rest/v1/settings`,
    CHANNELS: `${CFG.SUPABASE_URL}/rest/v1/channels`,
    DEFAULT_CHANNELS: `${CFG.SUPABASE_URL}/rest/v1/default_channels`
  };

  const MESSAGES = {
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

  const settingsTabButtons = document.querySelectorAll('.sidebar-tab-button');
  const settingsTabContents = document.querySelectorAll('.settings-tab-content');
  
  // Элементы бургер меню
  const burgerMenuBtn = document.getElementById('burger-menu-btn');
  const settingsSidebar = document.getElementById('settings-sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
  // Keywords elements
  const keywordsTagsContainer = document.getElementById('current-keywords-tags');
  const newKeywordInput = document.getElementById('new-keyword-input');
  const addKeywordBtn = document.getElementById('add-keyword-btn');
  
  // Keywords buttons
  const loadDefaultsKeywordsBtn = document.getElementById('load-defaults-keywords-btn');
  
  // Channels elements
  const addChannelBtn = document.getElementById('add-channel-btn');
  const channelInput = document.getElementById('channel-input');
  const channelsListContainer = document.getElementById('channels-list');
  const channelsCount = document.getElementById('channels-count');
  
  // Channels buttons
  const deleteAllBtn = document.getElementById('delete-all-btn');
  const loadDefaultsChannelsBtn = document.getElementById('load-defaults-channels-btn');

  // Функция обновления состояния крестика для ключевых слов
  function updateKeywordsInputState() {
    const keywordsInputWrapper = document.querySelector('.keywords-input-wrapper');
    if (keywordsInputWrapper && newKeywordInput) {
      const hasText = newKeywordInput.value.length > 0;
      keywordsInputWrapper.classList.toggle('has-text', hasText);
    }
  }

  // Обновление состояния кнопки удаления выбранных
  function updateDeleteSelectedButton() {
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');
    const selectedCount = document.querySelectorAll('.channel-select-checkbox:checked').length;
    
    if (deleteSelectedBtn) {
      deleteSelectedBtn.disabled = selectedCount === 0;
      deleteSelectedBtn.textContent = `Удалить выбранные (${selectedCount})`;
    }
  }

  // Обновление состояния кнопки переключения всех
  function updateToggleAllButton() {
    const toggleAllBtn = document.getElementById('channels-toggle-all');
    const checkboxes = document.querySelectorAll('.channel-select-checkbox');
    const selectedCount = document.querySelectorAll('.channel-select-checkbox:checked').length;
    
    if (toggleAllBtn && checkboxes.length > 0) {
      if (selectedCount === 0) {
        toggleAllBtn.textContent = 'Выбрать все';
      } else if (selectedCount === checkboxes.length) {
        toggleAllBtn.textContent = 'Снять выбор';
      } else {
        toggleAllBtn.textContent = 'Выбрать все';
      }
    }
  }

  /**
   * Валидирует и форматирует ID канала
   * @param {string} input - Входная строка (username, t.me ссылка или @username)
   * @returns {string|null} Отформатированный channelId или null при ошибке
   */
  function validateAndFormatChannelId(input) {
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
      safeAlert(MESSAGES.ERRORS.INVALID_FORMAT);
      return null;
    }
    
    return channelId;
  }

  /**
   * Проверяет существование канала в базе данных
   * @param {string} channelId - ID канала для проверки
   * @returns {Promise<boolean>} true если канал существует, false если нет
   */
  async function isChannelExists(channelId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.CHANNELS}?channel_id=eq.${encodeURIComponent(channelId)}&select=id`, {
        headers: {
          'apikey': CFG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CFG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const existingChannels = await response.json();
        return existingChannels.length > 0;
      } else {
        console.warn('⚠️ Ошибка проверки дубликатов:', response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Ошибка проверки существования канала:', error);
      return false;
    }
  }

  /**
   * Создает новый канал в базе данных и отображает его в интерфейсе
   * @param {string} channelId - ID канала для создания
   * @returns {Promise<Object>} Созданный объект канала
   */
  async function createChannel(channelId) {
    console.log('[DEBUG] Создание канала:', channelId);
    
    const newChannelData = { 
      channel_id: channelId, 
      channel_title: channelId, 
      is_enabled: true 
    };
    
    console.log('[DEBUG] Отправляемые данные:', newChannelData);
    console.log('[DEBUG] API URL:', API_ENDPOINTS.CHANNELS);
    
    const response = await fetch(API_ENDPOINTS.CHANNELS, {
      method: 'POST',
      headers: {
          'apikey': CFG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CFG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
      body: JSON.stringify(newChannelData)
    });
    
    console.log('[DEBUG] Ответ сервера:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DEBUG] Ошибка API:', errorText);
      throw new Error(`Ошибка API: ${response.status} ${response.statusText}. ${errorText}`);
    }
    
    const data = await response.json();
    console.log('[DEBUG] Полученные данные:', data);
    
    if (data && data.length > 0) {
      renderChannel(data[0]);
      channelInput.value = '';
      uiToast(MESSAGES.SUCCESS.CHANNEL_ADDED);
      console.log('[DEBUG] Канал успешно создан:', data[0]);
      return data[0];
    } else {
      console.error('[DEBUG] API не вернул данные о канале');
      throw new Error('API не вернул данные о добавленном канале');
    }
  }

  settingsTabButtons.forEach(button => {
    button.addEventListener('click', () => {
      settingsTabButtons.forEach(btn => btn.classList.remove('active'));
      settingsTabContents.forEach(content => content.classList.remove('active'));
      button.classList.add('active');
      const targetContent = document.getElementById(button.dataset.target);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // Хранилище текущих ключевых слов
  let currentKeywords = [];
  let saveTimeout = null;

  // Пресеты ключевых слов
  const KEYWORD_PRESETS = {
    video: ['монтаж', 'анимация', 'эффекты', 'цветокоррекция', 'видео'],
    design: ['дизайн', 'иллюстрация', 'типографика', 'брендинг', 'UI/UX'],
    development: ['программирование', 'веб', 'мобильные', 'API', 'база данных'],
    marketing: ['реклама', 'SMM', 'контент', 'аналитика', 'SEO']
  };

  function createKeywordTag(keyword) {
    const tag = document.createElement('div');
    tag.className = 'keyword-tag';
    tag.innerHTML = `
      <span class="keyword-tag-text">${escapeHtml(keyword)}</span>
      <button class="keyword-tag-remove" type="button" title="Удалить" data-keyword="${escapeHtml(keyword)}"></button>
    `;
    
    // Добавляем обработчик удаления
    const removeBtn = tag.querySelector('.keyword-tag-remove');
    removeBtn.addEventListener('click', () => {
      removeKeyword(keyword);
    });
    
    return tag;
  }

  function displayKeywordTags() {
    if (!keywordsTagsContainer) {
      console.error('displayKeywordTags: элемент keywordsTagsContainer не найден');
      return;
    }
    
    keywordsTagsContainer.innerHTML = '';
    
    if (currentKeywords.length === 0) {
      keywordsTagsContainer.innerHTML = '<div class="loading-indicator">-- ключевые слова не заданы --</div>';
      // Обновляем счетчик
      const countBadge = document.getElementById('keywords-count');
      if (countBadge) {
        countBadge.textContent = '0';
      }
      return;
    }
    
    currentKeywords.forEach(keyword => {
      if (keyword.trim()) {
        const tag = createKeywordTag(keyword.trim());
        keywordsTagsContainer.appendChild(tag);
      }
    });
    
    // Обновляем счетчик
    const countBadge = document.getElementById('keywords-count');
    if (countBadge) {
      countBadge.textContent = currentKeywords.length.toString();
    }
  }

  function addKeyword(keyword) {
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed || trimmed.length > 30) {
      safeAlert('Ключевое слово должно содержать от 1 до 30 символов');
      return false;
    }
    
    if (currentKeywords.map(k => k.toLowerCase()).includes(trimmed)) {
      safeAlert('Такое ключевое слово уже существует');
      return false;
    }
    
    currentKeywords.push(trimmed);
    debouncedSave();
    displayKeywordTags();
    
    return true;
  }

  function addKeywords(input) {
    const keywords = input.split(',').map(k => k.trim()).filter(k => k.length > 0);
    
    if (keywords.length === 0) {
      safeAlert('Введите хотя бы одно ключевое слово');
      return false;
    }
    
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const keyword of keywords) {
      if (keyword.length > 30) {
        safeAlert(`Ключевое слово "${keyword}" слишком длинное (максимум 30 символов)`);
        continue;
      }
      
      const trimmed = keyword.toLowerCase();
      if (!currentKeywords.map(k => k.toLowerCase()).includes(trimmed)) {
        currentKeywords.push(trimmed);
        addedCount++;
      } else {
        skippedCount++;
      }
    }
    
    if (addedCount > 0) {
      debouncedSave();
      displayKeywordTags();
      
      if (skippedCount > 0) {
        safeAlert(`Добавлено ${addedCount} слов, пропущено ${skippedCount} дубликатов`);
      }
    } else if (skippedCount > 0) {
      safeAlert('Все введённые слова уже существуют');
    }
    
    return addedCount > 0;
  }

  function removeKeyword(keyword) {
    const index = currentKeywords.findIndex(k => k.toLowerCase() === keyword.toLowerCase());
    if (index > -1) {
      // Анимация удаления
      const tagElement = keywordsTagsContainer.querySelector(`[data-keyword="${escapeHtml(keyword)}"]`)?.parentElement;
      if (tagElement) {
        tagElement.classList.add('removing');
        setTimeout(() => {
          currentKeywords.splice(index, 1);
          debouncedSave();
          displayKeywordTags();
        }, 200);
      } else {
        currentKeywords.splice(index, 1);
        debouncedSave();
        displayKeywordTags();
      }
    }
  }

  function debouncedSave() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      updateKeywordsInDatabase();
    }, 300); // Задержка 300мс для группировки изменений
  }

  async function updateKeywordsInDatabase() {
    const keywordsString = currentKeywords.join(', ');
    
    try {
      // Пробуем PATCH для обновления существующей записи
      const response = await fetch(`${API_ENDPOINTS.SETTINGS}?update_key=eq.1`, {
        method: 'PATCH',
        headers: {
          'apikey': CFG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CFG?.SUPABASE_ANON_KEY}`,
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
            headers: {
          'apikey': CFG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CFG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
            body: JSON.stringify({ update_key: 1, keywords: keywordsString })
          });
          
          if (!postResponse.ok) {
            throw new Error(`POST failed: HTTP ${postResponse.status}: ${postResponse.statusText}`);
          }
          console.log('Ключевые слова успешно созданы:', keywordsString);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log('Ключевые слова успешно обновлены:', keywordsString);
    } catch (error) {
      console.error('Ошибка сохранения ключевых слов:', error);
      if (error.message.includes('авторизации')) {
        safeAlert(error.message);
      } else {
        safeAlert('Ошибка сохранения ключевых слов. Проверьте подключение к интернету.');
      }
    }
  }

  async function loadKeywords() {
    if (!keywordsTagsContainer) {
        console.error('loadKeywords: элемент keywordsTagsContainer не найден');
        return;
    }
    keywordsTagsContainer.innerHTML = '<div class="loading-indicator">Загрузка...</div>';
    try {
      const response = await fetch(`${API_ENDPOINTS.SETTINGS}?select=keywords`, {
        headers: {
          'apikey': CFG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CFG?.SUPABASE_ANON_KEY}`,
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
      currentKeywords = keywords ? keywords.split(',').map(k => k.trim()).filter(k => k) : [];
      
      // Отображаем теги ключевых слов
      displayKeywordTags();
    } catch (error) {
      console.error('loadKeywords: произошла ошибка', error);
      if (error.message.includes('авторизации')) {
        keywordsTagsContainer.innerHTML = `<div class="loading-indicator error-indicator">${error.message}</div>`;
      } else {
        keywordsTagsContainer.innerHTML = '<div class="loading-indicator">Ошибка загрузки</div>';
      }
    } finally {
      // saveBtn больше не существует - все сохраняется автоматически
    }
  }

  async function saveKeywords() {
    if (!currentKeywords || currentKeywords.length === 0) {
      safeAlert('Нет ключевых слов для сохранения');
      return;
    }
    
    // saveBtn больше не существует - все сохраняется автоматически
    try {
      // Формируем строку ключевых слов из массива
      const keywordsString = currentKeywords.join(', ');
      
      // Используем PATCH для обновления как в updateKeywordsInDatabase
      const response = await fetch(`${API_ENDPOINTS.SETTINGS}?update_key=eq.1`, {
        method: 'PATCH',
        headers: {
          'apikey': CFG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CFG?.SUPABASE_ANON_KEY}`,
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
            headers: {
          'apikey': CFG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CFG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
            body: JSON.stringify({ update_key: 1, keywords: keywordsString })
          });
          
          if (!postResponse.ok) {
            throw new Error(`POST failed: HTTP ${postResponse.status}: ${postResponse.statusText}`);
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }
      
      uiToast(MESSAGES.SUCCESS.KEYWORDS_SAVED);
    } catch (error) {
      console.error('saveKeywords: произошла ошибка', error);
      if (error.message.includes('авторизации')) {
        safeAlert(error.message);
      } else {
        safeAlert('Не удалось сохранить настройки. Проверьте подключение к интернету.');
      }
    } finally {
      // saveBtn больше не существует - все сохраняется автоматически
    }
  }

  function renderChannel(channel) {
    const channelItem = document.createElement('div');
    channelItem.className = 'channel-item';
    channelItem.dataset.dbId = channel.id;
    
    // Добавляем чекбокс для выбора
    const selectContainer = document.createElement('div');
    selectContainer.className = 'channel-item-toggle';
    const selectInput = document.createElement('input');
    selectInput.type = 'checkbox';
    selectInput.className = 'channel-select-checkbox';
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'channel-item-info';
    
    const cleanId = channel.channel_id.replace('@', '');
    const titleSpan = document.createElement('span');
    titleSpan.className = 'channel-item-title';
    // Санитизируем текст для безопасности
    titleSpan.textContent = escapeHtml(channel.channel_title || cleanId);
    
    const idLink = document.createElement('a');
    idLink.className = 'channel-item-id';
    idLink.textContent = `@${cleanId}`;
    idLink.href = `https://t.me/${cleanId}`;
    idLink.target = '_blank';
    idLink.rel = 'noopener noreferrer';
    
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'channel-item-toggle';
    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'toggle-switch';
    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.checked = channel.is_enabled;
    const toggleSlider = document.createElement('span');
    toggleSlider.className = 'toggle-slider';
    
    const deleteButton = document.createElement('button');
    deleteButton.className = 'channel-item-delete';
    deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    
    // Создаем обработчики как отдельные функции для возможности cleanup
    const deleteHandler = async () => {
      const dbId = channelItem.dataset.dbId;
      console.log('[DEBUG] Удаление канала:', { dbId, channel_id: channel.channel_id });
      
      if (!dbId) {
        console.error('[DEBUG] Отсутствует dbId для удаления канала:', channel.channel_id);
        return;
      }
      
      const ok = await showCustomConfirm('Удалить этот канал?');
      if (!ok) return;
      
      channelItem.style.opacity = '0.5';
      try {
        const deleteUrl = `${API_ENDPOINTS.CHANNELS}?id=eq.${dbId}`;
        console.log('[DEBUG] URL удаления:', deleteUrl);
        
        const response = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
          'apikey': CFG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CFG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
        });
        
        console.log('[DEBUG] Ответ удаления:', response.status, response.statusText);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[DEBUG] Ошибка удаления:', errorText);
          throw new Error(`Ошибка ответа сети: ${response.status} ${errorText}`);
        }
        
        console.log('[DEBUG] Канал успешно удален из БД');
        channelItem.remove();
        uiToast(MESSAGES.SUCCESS.CHANNEL_DELETED);
        // Обновляем состояние кнопки удаления выбранных
        updateDeleteSelectedButton();
      } catch (error) {
        console.error('[DEBUG] Ошибка удаления канала:', error);
        safeAlert(MESSAGES.ERRORS.DELETE_FAILED);
        channelItem.style.opacity = '1';
      }
    };
    
    const toggleHandler = async (event) => {
      const dbId = channelItem.dataset.dbId;
      const is_enabled = event.target.checked;
      console.log('[DEBUG] Переключение канала:', { dbId, is_enabled, channel_id: channel.channel_id });
      
      if (!dbId) {
        console.error('[DEBUG] Отсутствует dbId для канала:', channel.channel_id);
        return;
      }
      
      try {
        const updateUrl = `${API_ENDPOINTS.CHANNELS}?id=eq.${dbId}`;
        console.log('[DEBUG] URL обновления:', updateUrl);
        
        const response = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
          'apikey': CFG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CFG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
          body: JSON.stringify({ is_enabled: is_enabled })
        });
        
        console.log('[DEBUG] Ответ обновления статуса:', response.status, response.statusText);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[DEBUG] Ошибка обновления:', errorText);
          throw new Error(`Ошибка ответа сети: ${response.status} ${errorText}`);
        }
        
        console.log('[DEBUG] Статус канала успешно обновлен');
        uiToast(is_enabled ? MESSAGES.SUCCESS.CHANNEL_TOGGLED : MESSAGES.SUCCESS.CHANNEL_DISABLED);
      } catch (error) {
        console.error('[DEBUG] Ошибка обновления статуса канала:', error);
        safeAlert(MESSAGES.ERRORS.UPDATE_FAILED);
        event.target.checked = !is_enabled;
      }
    };

    // Обработчик для чекбокса выбора
    const selectHandler = () => {
      if (selectInput.checked) {
        channelItem.classList.add('selected');
      } else {
        channelItem.classList.remove('selected');
      }
      updateDeleteSelectedButton();
    };
    
    deleteButton.addEventListener('click', deleteHandler);
    toggleInput.addEventListener('change', toggleHandler);
    selectInput.addEventListener('change', selectHandler);
    
    // Сохраняем cleanup функцию на элементе
    channelItem.cleanup = () => {
      deleteButton.removeEventListener('click', deleteHandler);
      toggleInput.removeEventListener('change', toggleHandler);
      selectInput.removeEventListener('change', selectHandler);
    };
    
    selectContainer.appendChild(selectInput);
    infoDiv.append(titleSpan, idLink);
    toggleLabel.append(toggleInput, toggleSlider);
    toggleContainer.append(toggleLabel);
    channelItem.append(selectContainer, infoDiv, toggleContainer, deleteButton);
    
    const emptyListMessage = channelsListContainer.querySelector('.empty-list');
    if (emptyListMessage) emptyListMessage.remove();
    channelsListContainer.appendChild(channelItem);
  }
  
  async function addChannel() {
    const channelId = validateAndFormatChannelId(channelInput.value);
    if (!channelId) return;
    
    addChannelBtn.disabled = true;
    
    try {
      // Проверяем существование канала
      if (await isChannelExists(channelId)) {
        safeAlert(MESSAGES.ERRORS.CHANNEL_EXISTS);
        return;
      }
      
      // Создаем новый канал
      await createChannel(channelId);
      
    } catch (error) {
      console.error('Ошибка добавления канала:', error);
      safeAlert(`${MESSAGES.ERRORS.ADD_FAILED}: ${error.message}`);
    } finally {
      addChannelBtn.disabled = false;
    }
  }

  async function loadChannels() {
    if (!channelsListContainer) {
        console.error('loadChannels: элемент channelsListContainer не найден');
        return;
    }
    channelsListContainer.innerHTML = '<p class="empty-list">Загрузка каналов...</p>';
    try {
      const response = await fetch(`${API_ENDPOINTS.CHANNELS}?select=*`, {
        headers: {
          'apikey': CFG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CFG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Ошибка авторизации: недействительный API ключ. Обратитесь к разработчику для обновления конфигурации.');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      channelsListContainer.innerHTML = '';
      if (data && data.length > 0) {
          data.forEach(item => renderChannel(item));
      } else {
          channelsListContainer.innerHTML = '<p class="empty-list">-- Список каналов пуст --</p>';
      }
      
      // Обновляем состояние кнопки удаления выбранных
      updateDeleteSelectedButton();
    } catch (error) {
      console.error('loadChannels: произошла ошибка', error);
      if (error.message.includes('авторизации')) {
        channelsListContainer.innerHTML = `<p class="empty-list error-list">${error.message}</p>`;
      } else {
        channelsListContainer.innerHTML = '<p class="empty-list">Не удалось загрузить каналы.</p>';
      }
    }
  }

  addChannelBtn?.addEventListener('click', addChannel);

  // Обработчики для кнопок "Загрузить стандартные"
  document.addEventListener('click', async (e) => {
    if (e.target.closest('#load-defaults-keywords-btn')) {
      // Загружаем стандартные ключевые слова
      await loadDefaultKeywords();
    } else if (e.target.closest('#load-defaults-channels-btn')) {
      // Загружаем стандартные каналы
      await loadDefaultChannels();
    }
  });

  // Функция загрузки стандартных ключевых слов
  async function loadDefaultKeywords() {
    if (loadDefaultsKeywordsBtn) loadDefaultsKeywordsBtn.disabled = true;
    
    try {
      // Стандартные ключевые слова для фриланса
      const defaultKeywords = [
        'монтаж', 'анимация', 'дизайн', 'разработка', 'копирайтинг',
        'перевод', 'фото', 'видео', 'звук', '3d', 'веб', 'мобильное'
      ];
      
      // Добавляем стандартные ключевые слова, если их нет
      const newKeywords = defaultKeywords.filter(keyword => 
        !currentKeywords.includes(keyword.toLowerCase())
      );
      
      if (newKeywords.length === 0) {
        safeAlert('Все стандартные ключевые слова уже добавлены!');
        return;
      }
      
      // Добавляем новые ключевые слова
      newKeywords.forEach(keyword => {
        currentKeywords.push(keyword.toLowerCase());
      });
      
      // Обновляем интерфейс
      displayKeywordTags();
      
      // Сохраняем в базу данных
      await updateKeywordsInDatabase();
      
      uiToast(`Добавлено ${newKeywords.length} новых стандартных ключевых слов`);
    } catch (error) {
      console.error('Ошибка загрузки стандартных ключевых слов:', error);
      safeAlert(`Не удалось добавить стандартные ключевые слова: ${error.message}`);
    } finally {
      if (loadDefaultsKeywordsBtn) loadDefaultsKeywordsBtn.disabled = false;
    }
  }

  // Функция загрузки стандартных каналов
  async function loadDefaultChannels() {
    if (loadDefaultsChannelsBtn) loadDefaultsChannelsBtn.disabled = true;
    
    try {
      // Сначала получаем текущие каналы
      const currentChannelsResponse = await fetch(`${API_ENDPOINTS.CHANNELS}?select=channel_id`, {
        headers: {
          'apikey': CFG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CFG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!currentChannelsResponse.ok) {
        throw new Error('Не удалось получить текущие каналы');
      }
      
      const currentChannels = await currentChannelsResponse.json();
      const currentChannelIds = currentChannels.map(ch => ch.channel_id);
      
      // Получаем стандартные каналы
      const response = await fetch(`${API_ENDPOINTS.DEFAULT_CHANNELS}?select=channel_id`, {
        headers: {
          'apikey': CFG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CFG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Не удалось получить стандартные каналы');
      }
      
      const defaultChannels = await response.json();
      if (defaultChannels.length === 0) {
        safeAlert('Список стандартных каналов пуст.');
        return;
      }
      
      // Фильтруем только те каналы, которых еще нет
      const newChannels = defaultChannels.filter(ch => 
        !currentChannelIds.includes(ch.channel_id)
      );
      
      if (newChannels.length === 0) {
        safeAlert('Все стандартные каналы уже добавлены!');
        return;
      }
      
      // Добавляем только новые каналы
      const channelsToUpsert = newChannels.map(ch => ({ 
        channel_id: ch.channel_id, 
        is_enabled: true 
      }));
      
      const addResponse = await fetch(API_ENDPOINTS.CHANNELS, {
        method: 'POST',
        headers: {
          'apikey': CFG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CFG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(channelsToUpsert)
      });
      
      if (!addResponse.ok) {
        throw new Error(`Ошибка добавления каналов: ${addResponse.status}`);
      }
      
      // Обновляем список каналов
      await loadChannels();
      uiToast(`Добавлено ${newChannels.length} новых стандартных каналов`);
      
    } catch (error) {
      console.error('Ошибка загрузки стандартных каналов:', error);
      uiToast(`Не удалось добавить стандартные каналы: ${error.message}`);
    } finally {
      if (loadDefaultsChannelsBtn) loadDefaultsChannelsBtn.disabled = false;
    }
  }

  deleteAllBtn?.addEventListener('click', async () => {
    const message = 'Удалить все каналы из базы? Это действие необратимо.';
    const isConfirmed = await showCustomConfirm(message);
    if (!isConfirmed) return;
    deleteAllBtn.disabled = true;
    try {
      await fetch(`${API_ENDPOINTS.CHANNELS}?id=gt.0`, {
        method: 'DELETE',
        headers: {
          'apikey': CFG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CFG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      channelsListContainer.innerHTML = '<p class="empty-list">-- Список каналов пуст --</p>';
      uiToast(MESSAGES.SUCCESS.ALL_DELETED);
    } catch (error) {
      console.error('Ошибка удаления каналов:', error);
      safeAlert(String(error));
    } finally {
      deleteAllBtn.disabled = false;
    }
  });

  // Обработчики для визуальных тегов ключевых слов
  if (addKeywordBtn) {
    addKeywordBtn.addEventListener('click', () => {
      const input = newKeywordInput?.value?.trim();
      if (input && addKeywords(input)) {
        newKeywordInput.value = '';
        // Обновляем состояние крестика
        updateKeywordsInputState();
      }
    });
  }

  if (newKeywordInput) {
    newKeywordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const input = newKeywordInput.value.trim();
        if (input && addKeywords(input)) {
          newKeywordInput.value = '';
          // Обновляем состояние крестика
          updateKeywordsInputState();
        }
      }
    });
  }

  // === ФУНКЦИОНАЛЬНОСТЬ ТЕМНОЙ ТЕМЫ ===
  
  // Инициализация темы
  function initTheme() {
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    const savedReduceAnimations = localStorage.getItem('reduce-animations') === 'true';
    const savedHighContrast = localStorage.getItem('high-contrast') === 'true';
    
    // Устанавливаем сохраненную тему без уведомления
    setTheme(savedTheme, false);
    
    // Устанавливаем состояние переключателей
    const themeRadio = document.querySelector(`input[name="theme"][value="${savedTheme}"]`);
    if (themeRadio) themeRadio.checked = true;
    
    const reduceAnimationsCheckbox = document.getElementById('reduce-animations');
    if (reduceAnimationsCheckbox) {
      reduceAnimationsCheckbox.checked = savedReduceAnimations;
      if (savedReduceAnimations) {
        document.body.classList.add('reduce-animations');
      }
    }
    
    const highContrastCheckbox = document.getElementById('high-contrast');
    if (highContrastCheckbox) {
      highContrastCheckbox.checked = savedHighContrast;
      if (savedHighContrast) {
        document.body.classList.add('high-contrast');
      }
    }
    
    // Интеграция с Telegram WebApp Theme
    if (tg && tg.themeParams) {
      applyTelegramTheme(tg.themeParams);
    }
  }
  
  function setTheme(theme, showNotification = true) {
    const body = document.body;
    
    // Удаляем все классы тем
    body.classList.remove('dark-theme');
    body.removeAttribute('data-theme');
    
    switch (theme) {
      case 'dark':
        body.setAttribute('data-theme', 'dark');
        break;
      case 'light':
      default:
        body.setAttribute('data-theme', 'light');
        break;
    }
    
    localStorage.setItem('app-theme', theme);
    
    // Уведомляем о смене темы только если это не инициализация
    if (showNotification && typeof uiToast === 'function') {
      const themeNames = { light: 'Светлая', dark: 'Темная' };
      uiToast(`Тема изменена: ${themeNames[theme] || theme}`);
    }
  }
  
  function applyTelegramTheme(themeParams) {
    if (!themeParams) return;
    
    const root = document.documentElement;
    
    // Применяем цвета из Telegram
    if (themeParams.bg_color) {
      root.style.setProperty('--tg-theme-bg-color', themeParams.bg_color);
      root.style.setProperty('--background-color', themeParams.bg_color);
    }
    
    if (themeParams.text_color) {
      root.style.setProperty('--tg-theme-text-color', themeParams.text_color);
      root.style.setProperty('--text-color', themeParams.text_color);
    }
    
    if (themeParams.hint_color) {
      root.style.setProperty('--tg-theme-hint-color', themeParams.hint_color);
      root.style.setProperty('--hint-color', themeParams.hint_color);
    }
    
    if (themeParams.link_color) {
      root.style.setProperty('--tg-theme-link-color', themeParams.link_color);
      root.style.setProperty('--link-color', themeParams.link_color);
    }
    
    if (themeParams.button_color) {
      root.style.setProperty('--tg-theme-button-color', themeParams.button_color);
      root.style.setProperty('--button-bg', themeParams.button_color);
    }
    
    if (themeParams.button_text_color) {
      root.style.setProperty('--tg-theme-button-text-color', themeParams.button_text_color);
      root.style.setProperty('--button-text', themeParams.button_text_color);
    }
    
    if (themeParams.secondary_bg_color) {
      root.style.setProperty('--tg-theme-secondary-bg-color', themeParams.secondary_bg_color);
      root.style.setProperty('--secondary-bg', themeParams.secondary_bg_color);
    }
    
    if (themeParams.header_bg_color) {
      root.style.setProperty('--tg-theme-header-bg-color', themeParams.header_bg_color);
      root.style.setProperty('--header-bg', themeParams.header_bg_color);
    }
    
    if (themeParams.destructive_text_color) {
      root.style.setProperty('--tg-theme-destructive-text-color', themeParams.destructive_text_color);
      root.style.setProperty('--destructive-color', themeParams.destructive_text_color);
    }
    
    if (themeParams.section_separator_color) {
      root.style.setProperty('--tg-theme-section-separator-color', themeParams.section_separator_color);
      root.style.setProperty('--section-separator', themeParams.section_separator_color);
    }
  }
  
  // Обработчики событий для переключения темы
  const themeRadios = document.querySelectorAll('input[name="theme"]');
  themeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        const selectedTheme = e.target.value;
        console.log('Переключение темы на:', selectedTheme);
        setTheme(selectedTheme);
        
        // Обновляем состояние всех радиокнопок
        themeRadios.forEach(r => r.checked = false);
        e.target.checked = true;
      }
    });
  });
  
  // Бургер меню и навигация
  function initBurgerMenu() {
    // Проверяем наличие всех элементов
    if (!burgerMenuBtn || !settingsSidebar || !sidebarOverlay) {
      console.log('Burger menu elements not found:', {
        burgerMenuBtn: !!burgerMenuBtn,
        settingsSidebar: !!settingsSidebar,
        sidebarOverlay: !!sidebarOverlay
      });
      return;
    }

    // Открытие меню
    function openSidebar() {
      // Бургер сразу уходит за меню
      burgerMenuBtn.style.zIndex = '999';
      
      burgerMenuBtn.classList.add('active');
      settingsSidebar.classList.add('active');
      sidebarOverlay.classList.add('active');
      
      // Анимация появления кнопок с задержкой
      setTimeout(() => {
        const sidebarNav = document.querySelector('.sidebar-nav');
        if (sidebarNav) {
          sidebarNav.classList.add('animate');
          
          // Добавляем класс animated каждой кнопке после завершения её анимации
          const buttons = sidebarNav.querySelectorAll('.sidebar-tab-button');
          buttons.forEach((button, index) => {
            setTimeout(() => {
              button.classList.add('animated');
            }, 600 + (index * 150)); // 600ms анимация + задержка для каждой кнопки
          });
        }
      }, 200);
      
      // Блокируем прокрутку body
      document.body.style.overflow = 'hidden';
      
      // Тактильная обратная связь (только для поддерживаемых версий)
      if (tg && tg.HapticFeedback && tg.HapticFeedback.impactOccurred && tg.version >= 6.1) {
        try {
          tg.HapticFeedback.impactOccurred('medium');
        } catch (e) {
          console.log('HapticFeedback not supported:', e);
        }
      }
    }
    
    // Закрытие меню
    function closeSidebar() {
      burgerMenuBtn.classList.remove('active');
      settingsSidebar.classList.remove('active');
      sidebarOverlay.classList.remove('active');
      
      // Сбрасываем состояния анимации кнопок
      const sidebarNav = document.querySelector('.sidebar-nav');
      if (sidebarNav) {
        sidebarNav.classList.remove('animate');
        const buttons = sidebarNav.querySelectorAll('.sidebar-tab-button');
        buttons.forEach(button => {
          button.classList.remove('animated');
        });
      }
      
      // Возвращаем бургер наверх
      burgerMenuBtn.style.zIndex = '1001';
      
      // Разблокируем прокрутку body
      document.body.style.overflow = '';
      
      // Тактильная обратная связь (только для поддерживаемых версий)
      if (tg && tg.HapticFeedback && tg.HapticFeedback.impactOccurred && tg.version >= 6.1) {
        try {
          tg.HapticFeedback.impactOccurred('light');
        } catch (e) {
          console.log('HapticFeedback not supported:', e);
        }
      }
    }
    
    // Обработчики событий
    burgerMenuBtn.addEventListener('click', openSidebar);
    
    if (sidebarCloseBtn) {
      sidebarCloseBtn.addEventListener('click', closeSidebar);
    }
    
    sidebarOverlay.addEventListener('click', closeSidebar);
    
    // Закрытие по Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && settingsSidebar.classList.contains('active')) {
        closeSidebar();
      }
    });
  }

  // Навигация по вкладкам в сайдбаре
  function initSidebarTabs() {
    const tabButtons = document.querySelectorAll('.sidebar-tab-button');
    const tabContents = document.querySelectorAll('.settings-tab-content');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', function() {
        const targetId = this.getAttribute('data-target');
        
        // Добавляем эффект глитча
        this.classList.add('switching');
        
        // Обновляем активные состояния
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        this.classList.add('active');
        const targetContent = document.getElementById(targetId);
        if (targetContent) {
          targetContent.classList.add('active');
        }
        
        // Закрываем сайдбар после выбора вкладки
        setTimeout(() => {
          burgerMenuBtn.classList.remove('active');
          settingsSidebar.classList.remove('active');
          sidebarOverlay.classList.remove('active');
          document.body.style.overflow = '';
          
          this.classList.remove('switching');
        }, 300);
        
        // Тактильная обратная связь (только для поддерживаемых версий)
        if (tg && tg.HapticFeedback && tg.HapticFeedback.impactOccurred && tg.version >= 6.1) {
          try {
            tg.HapticFeedback.impactOccurred('light');
          } catch (e) {
            console.log('HapticFeedback not supported:', e);
          }
        }
      });
    });
  }
  
  // Функция для воспроизведения ретро-звука
  function playRetroSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
      // Игнорируем ошибки аудио
    }
  }
  
  // Обработчик для уменьшения анимаций
  const reduceAnimationsCheckbox = document.getElementById('reduce-animations');
  if (reduceAnimationsCheckbox) {
    reduceAnimationsCheckbox.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      localStorage.setItem('reduce-animations', isChecked.toString());
      
      if (isChecked) {
        document.body.classList.add('reduce-animations');
      } else {
        document.body.classList.remove('reduce-animations');
      }
      
      uiToast(isChecked ? 'Анимации уменьшены' : 'Анимации восстановлены');
    });
  }
  
  // Обработчик для высокого контраста
  const highContrastCheckbox = document.getElementById('high-contrast');
  if (highContrastCheckbox) {
    highContrastCheckbox.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      localStorage.setItem('high-contrast', isChecked.toString());
      
      if (isChecked) {
        document.body.classList.add('high-contrast');
      } else {
        document.body.classList.remove('high-contrast');
      }
      
      uiToast(isChecked ? 'Высокий контраст включен' : 'Высокий контраст выключен');
    });
  }
  
  // Слушаем изменения системной темы
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addListener(() => {
      const currentTheme = localStorage.getItem('app-theme');
      if (currentTheme === 'auto') {
        // Обновляем отображение при изменении системной темы
        uiToast('Тема обновлена согласно системным настройкам');
      }
    });
  }
  
  // Инициализация улучшенных секций настроек
  function initEnhancedSettings() {
    initKeywordsSection();
    initChannelsSection();
    initAppearanceSection();
  }

  // === СЕКЦИЯ КЛЮЧЕВЫХ СЛОВ ===
  function initKeywordsSection() {
    const expandBtn = document.getElementById('keywords-expand-btn');
    const keywordsExpanded = document.getElementById('keywords-expanded');
    const addTabBtns = document.querySelectorAll('.add-tab-btn');
    const addTabContents = document.querySelectorAll('.add-tab-content');
    const suggestionTags = document.querySelectorAll('.suggestion-tag');
    const batchInput = document.getElementById('batch-keywords-input');
    const clearBatchBtn = document.getElementById('clear-batch-btn');
    const clearAllKeywordsBtn = document.getElementById('clear-all-keywords-btn');

    // Загружаем ключевые слова из базы данных
    loadKeywords();
    
    // Обновляем состояние крестика после загрузки
    setTimeout(() => {
      updateKeywordsInputState();
    }, 100);

    // Кнопка очистки всех ключевых слов
    if (clearAllKeywordsBtn) {
      clearAllKeywordsBtn.addEventListener('click', async () => {
        if (currentKeywords.length === 0) {
          safeAlert('Нет ключевых слов для очистки');
          return;
        }
        
        const isConfirmed = await showCustomConfirm(
          `Очистить все ${currentKeywords.length} ключевых слов? Это действие необратимо.`
        );
        
        if (isConfirmed) {
          currentKeywords.length = 0; // Очищаем массив
          displayKeywordTags(); // Обновляем интерфейс
          await updateKeywordsInDatabase(); // Сохраняем в базу
          uiToast('Все ключевые слова очищены');
        }
      });
    }

    // Разворачивание/сворачивание секции
    if (expandBtn && keywordsExpanded) {
      expandBtn.addEventListener('click', () => {
        const isExpanded = keywordsExpanded.style.display !== 'none';
        
        if (isExpanded) {
          keywordsExpanded.style.display = 'none';
          expandBtn.classList.remove('expanded');
          expandBtn.setAttribute('aria-label', 'Развернуть ключевые слова');
        } else {
          keywordsExpanded.style.display = 'block';
          expandBtn.classList.add('expanded');
          expandBtn.setAttribute('aria-label', 'Свернуть ключевые слова');
        }
      });
    }

    // Переключение вкладок добавления
    addTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        
        // Обновляем активные состояния
        addTabBtns.forEach(b => b.classList.remove('active'));
        addTabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(`add-${targetTab}`).classList.add('active');
      });
    });

    // Подсказки ключевых слов
    suggestionTags.forEach(tag => {
      tag.addEventListener('click', () => {
        const keyword = tag.getAttribute('data-keyword');
        const input = document.getElementById('new-keyword-input');
        input.value = keyword;
        input.focus();
        
        // Обновляем состояние крестика
        updateKeywordsInputState();
        
        // Анимация нажатия
        tag.style.transform = 'scale(0.95)';
        setTimeout(() => {
          tag.style.transform = '';
        }, 150);
      });
    });

    // Очистка формы пачкового добавления
    if (clearBatchBtn && batchInput) {
      clearBatchBtn.addEventListener('click', () => {
        batchInput.value = '';
        batchInput.focus();
      });
    }
  }



     // === СЕКЦИЯ КАНАЛОВ ===
     function initChannelsSection() {
    const toggleAllBtn = document.getElementById('channels-toggle-all');
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');
    const exampleBtns = document.querySelectorAll('.example-btn');
    const channelInput = document.getElementById('channel-input');

    // Загружаем каналы из базы данных
    loadChannels();

     // Переключение выбора всех каналов
     if (toggleAllBtn) {
       toggleAllBtn.addEventListener('click', () => {
         const checkboxes = document.querySelectorAll('.channel-select-checkbox');
         const allSelected = checkboxes.length > 0 && 
                           Array.from(checkboxes).every(cb => cb.checked);
         
         // Если все выбраны - снимаем выбор, иначе - выбираем все
         checkboxes.forEach(cb => {
           cb.checked = !allSelected;
           const channelItem = cb.closest('.channel-item');
           if (channelItem) {
             if (!allSelected) {
               channelItem.classList.add('selected');
             } else {
               channelItem.classList.remove('selected');
             }
           }
         });
         
         updateDeleteSelectedButton();
         updateToggleAllButton();
       });
     }

         // Удаление выбранных каналов
     if (deleteSelectedBtn) {
       deleteSelectedBtn.addEventListener('click', () => {
         const selectedChannels = document.querySelectorAll('.channel-select-checkbox:checked');
         if (selectedChannels.length > 0) {
           showCustomConfirm(
             `Удалить ${selectedChannels.length} выбранных каналов?`
           ).then(confirmed => {
             if (confirmed) {
               selectedChannels.forEach(async cb => {
                 const channelItem = cb.closest('.channel-item');
                 const dbId = channelItem.dataset.dbId;
                 
                 if (dbId) {
                   try {
                     // Удаляем из базы данных
                     const response = await fetch(`${API_ENDPOINTS.CHANNELS}?id=eq.${dbId}`, {
                       method: 'DELETE',
                       headers: {
          'apikey': CFG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CFG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
                     });
                     
                     if (response.ok) {
                       channelItem.style.animation = 'fadeOut 0.3s ease-out forwards';
                       setTimeout(() => {
                         channelItem.remove();
                         updateDeleteSelectedButton();
                         updateToggleAllButton();
                       }, 300);
                     } else {
                       console.error('Ошибка удаления канала из БД:', response.statusText);
                       safeAlert('Ошибка удаления канала из базы данных');
                     }
                   } catch (error) {
                     console.error('Ошибка при удалении канала:', error);
                     safeAlert('Ошибка при удалении канала');
                   }
                 }
               });
             }
           });
         }
       });
     }

    // Примеры форматов каналов
    exampleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const example = btn.getAttribute('data-example');
        if (channelInput) {
          channelInput.value = example;
          channelInput.focus();
          
          // Анимация нажатия
          btn.style.transform = 'scale(0.95)';
          setTimeout(() => {
            btn.style.transform = '';
          }, 150);
        }
      });
    });

         // Обработка выбора отдельных каналов
     document.addEventListener('change', (e) => {
       if (e.target.type === 'checkbox' && e.target.classList.contains('channel-select-checkbox')) {
         const channelItem = e.target.closest('.channel-item');
         if (channelItem) {
           if (e.target.checked) {
             channelItem.classList.add('selected');
           } else {
             channelItem.classList.remove('selected');
           }
         }
         updateDeleteSelectedButton();
         updateToggleAllButton();
       }
     });

     // Инициализация состояния кнопок
     updateDeleteSelectedButton();
     updateToggleAllButton();
  }



  // === СЕКЦИЯ ВНЕШНЕГО ВИДА ===
  function initAppearanceSection() {
    const themeToggle = document.getElementById('theme-toggle');
    const lightPreview = document.getElementById('light-preview');
    const darkPreview = document.getElementById('dark-preview');

    // Переключатель темы
    if (themeToggle) {
      // Устанавливаем начальное состояние
      const currentTheme = localStorage.getItem('app-theme') || 'light';
      themeToggle.checked = currentTheme === 'dark';
      updateThemePreviews(currentTheme);

      // Обработка переключения
      themeToggle.addEventListener('change', () => {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        setTheme(newTheme);
        updateThemePreviews(newTheme);
        
        // Анимация переключения
        themeToggle.style.transform = 'scale(1.1)';
        setTimeout(() => {
          themeToggle.style.transform = '';
        }, 200);
      });
    }

    // Предварительный просмотр тем
    if (lightPreview && darkPreview) {
      lightPreview.addEventListener('click', () => {
        if (themeToggle && !themeToggle.checked) return;
        themeToggle.checked = false;
        setTheme('light');
        updateThemePreviews('light');
      });

      darkPreview.addEventListener('click', () => {
        if (themeToggle && themeToggle.checked) return;
        themeToggle.checked = true;
        setTheme('dark');
        updateThemePreviews('dark');
      });
    }

    // Обработчики для новых кнопок унифицированной структуры
    const applyThemeBtn = document.querySelector('.appearance-action-btn.appearance-action-success');
    const statsBtn = document.querySelector('.appearance-action-btn.appearance-action-info');

    if (applyThemeBtn) {
      applyThemeBtn.addEventListener('click', () => {
        const currentTheme = localStorage.getItem('app-theme') || 'light';
        // Применяем текущую тему с анимацией
        document.body.style.transition = 'all 0.3s ease';
        setTimeout(() => {
          document.body.style.transition = '';
        }, 300);
        
        uiToast(`Тема "${currentTheme === 'light' ? 'Светлая' : 'Темная'}" применена!`);
      });
    }

    if (statsBtn) {
      statsBtn.addEventListener('click', () => {
        const currentTheme = localStorage.getItem('app-theme') || 'light';
        const themeStats = {
          light: 'Используется светлая тема. Подходит для дневного времени.',
          dark: 'Используется темная тема. Подходит для ночного времени и экономии батареи.'
        };
        
        uiToast(themeStats[currentTheme]);
      });
    }
  }

  // Обновление предварительного просмотра тем
  function updateThemePreviews(activeTheme) {
    const lightPreview = document.getElementById('light-preview');
    const darkPreview = document.getElementById('dark-preview');
    
    if (lightPreview && darkPreview) {
      lightPreview.classList.toggle('active', activeTheme === 'light');
      darkPreview.classList.toggle('active', activeTheme === 'dark');
    }
  }

  // === ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ===

  // Показ диалога подтверждения
  function showConfirmDialog(message, onConfirm) {
    const overlay = document.getElementById('custom-confirm-overlay');
    const text = document.getElementById('custom-confirm-text');
    const confirmBtn = document.getElementById('confirm-btn-ok');
    const cancelBtn = document.getElementById('confirm-btn-cancel');
    
    if (overlay && text && confirmBtn && cancelBtn) {
      text.textContent = message;
      overlay.classList.remove('hidden');
      
      // Обработчики кнопок
      const handleConfirm = () => {
        overlay.classList.add('hidden');
        onConfirm();
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
      };
      
      const handleCancel = () => {
        overlay.classList.add('hidden');
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
      };
      
      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);
    }
  }

  // Анимация появления элементов
  function animateElement(element, animation) {
    element.style.animation = 'none';
    element.offsetHeight; // Trigger reflow
    element.style.animation = animation;
  }

  // Инициализация при загрузке страницы
  document.addEventListener('DOMContentLoaded', function() {
    initTheme();
    initBurgerMenu();
    initSidebarTabs();
    
    // Инициализация секций настроек
    initEnhancedSettings();
    
    // Добавляем CSS анимации с nonce для CSP
    const style = window.cspManager?.createStyleElement() || document.createElement('style');
    style.textContent = `
      @keyframes fadeOut {
        to {
          opacity: 0;
          transform: translateX(-20px);
        }
      }
      
      .preview-tag {
        background: var(--accent-blue);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        font-family: var(--font-mono);
      }
      
      .preview-more {
        background: var(--hint-color);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        font-family: var(--font-mono);
      }
      
      .no-keywords {
        color: var(--hint-color);
        font-style: italic;
        font-size: 14px;
      }
    `;
    document.head.appendChild(style);
  });

  // === ДОПОЛНИТЕЛЬНЫЕ ОБРАБОТЧИКИ ДЛЯ НОВОГО ИНТЕРФЕЙСА ===

  // Обработчик для добавления ключевого слова по одному
  if (addKeywordBtn) {
    addKeywordBtn.addEventListener('click', () => {
      const keyword = newKeywordInput?.value?.trim();
      if (keyword && addKeyword(keyword)) {
        newKeywordInput.value = '';
      }
    });
  }

  // === ФУНКЦИИ ДЛЯ РАБОТЫ С ПРЕСЕТАМИ ===

  // Показать модальное окно с пресетами
  function showPresetsModal() {
    const modal = document.getElementById('presets-modal');
    if (modal) {
      modal.classList.add('active');
    }
  }

  // Закрыть модальное окно с пресетами
  function closePresetsModal() {
    const modal = document.getElementById('presets-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  // Загрузить пресет
  function loadPreset(presetType) {
    const preset = KEYWORD_PRESETS[presetType];
    if (preset) {
      // Очищаем текущие ключевые слова
      currentKeywords = [];
      
      // Добавляем слова из пресета
      preset.forEach(keyword => {
        if (!currentKeywords.includes(keyword)) {
          currentKeywords.push(keyword);
        }
      });
      
      // Обновляем интерфейс
      displayKeywordTags();
      updateKeywordsCount();
      
      // Закрываем модальное окно
      closePresetsModal();
      
      // Показываем уведомление
      uiToast(`Загружен пресет: ${presetType}`);
    }
  }

  // Сохранить как пресет (заглушка)
  function saveAsPreset() {
    if (currentKeywords.length === 0) {
      uiToast('Нет ключевых слов для сохранения');
      return;
    }
    
    // Заглушка - в реальном приложении здесь будет сохранение в базу
    const presetName = prompt('Введите название пресета:', 'Мой пресет');
    if (presetName) {
      uiToast(`Пресет "${presetName}" сохранен! (заглушка)`);
      console.log('Сохранение пресета:', { name: presetName, keywords: currentKeywords });
    }
  }

  // Обработчики для новых кнопок
  const loadPresetsBtn = document.getElementById('load-presets-btn');
  const saveAsPresetBtn = document.getElementById('save-as-preset-btn');


  if (loadPresetsBtn) {
    loadPresetsBtn.addEventListener('click', showPresetsModal);
  }

  if (saveAsPresetBtn) {
    saveAsPresetBtn.addEventListener('click', saveAsPreset);
  }



  // Обработчики для пресетов в модальном окне
  document.addEventListener('click', (e) => {
    if (e.target.closest('.preset-option')) {
      const presetOption = e.target.closest('.preset-option');
      const presetType = presetOption.dataset.preset;
      if (presetType) {
        loadPreset(presetType);
      }
    }
  });

  // === ФУНКЦИИ ДЛЯ РЕНДЕРИНГА ===

  // Обновить счетчик ключевых слов
  function updateKeywordsCount() {
    const countElement = document.getElementById('keywords-count');
    if (countElement) {
      countElement.textContent = currentKeywords.length;
    }
  }





  // Удалить ключевое слово
  function removeKeyword(keyword) {
    const index = currentKeywords.indexOf(keyword);
    if (index > -1) {
          currentKeywords.splice(index, 1);
    displayKeywordTags();
    updateKeywordsCount();
      
      // Автосохранение
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveKeywordToDatabase();
      }, 1000);
    }
  }



  // Загрузить ключевые слова из базы данных
  async function loadKeywords() {
    if (!keywordsTagsContainer) {
      console.error('loadKeywords: элемент keywordsTagsContainer не найден');
      return;
    }
    
    keywordsTagsContainer.innerHTML = '<div class="loading-indicator">Загрузка...</div>';
    
    try {
      const response = await fetch(`${API_ENDPOINTS.SETTINGS}?select=keywords`, {
        headers: {
          'apikey': CFG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CFG?.SUPABASE_ANON_KEY}`,
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
      currentKeywords = keywords ? keywords.split(',').map(k => k.trim()).filter(k => k) : [];
      
      // Отображаем теги ключевых слов
      displayKeywordTags();
    } catch (error) {
      console.error('loadKeywords: произошла ошибка', error);
      if (error.message.includes('авторизации')) {
        keywordsTagsContainer.innerHTML = `<div class="loading-indicator error-indicator">${error.message}</div>`;
      } else {
        keywordsTagsContainer.innerHTML = '<div class="loading-indicator">Ошибка загрузки</div>';
      }
    }
  }

  // Сохранить ключевые слова в базу данных
  async function saveKeywordToDatabase(keyword = null) {
    try {
      const keywordsString = currentKeywords.join(', ');
      
      const response = await fetch(`${API_ENDPOINTS.SETTINGS}?update_key=eq.1`, {
        method: 'PATCH',
        headers: {
          'apikey': CFG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CFG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ keywords: keywordsString })
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Ошибка авторизации: недействительный API ключ.');
        }
        if (response.status === 404) {
          // Если записи нет, создаем новую
          const postResponse = await fetch(API_ENDPOINTS.SETTINGS, {
            method: 'POST',
            headers: {
          'apikey': CFG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CFG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
            body: JSON.stringify({ update_key: 1, keywords: keywordsString })
          });
          
          if (!postResponse.ok) {
            throw new Error(`POST failed: HTTP ${postResponse.status}`);
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }
      
      if (keyword) {
        console.log('Ключевое слово сохранено в базу:', keyword);
        uiToast(`Ключевое слово "${keyword}" сохранено`);
      } else {
        console.log('Все ключевые слова сохранены в базу');
        uiToast('Ключевые слова сохранены');
      }
    } catch (error) {
      console.error('Ошибка сохранения ключевых слов:', error);
      uiToast('Ошибка сохранения ключевых слов');
    }
  }

  // Закрыть модальное окно пресетов
  function closePresetsModal() {
    const modal = document.getElementById('presets-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  // Инициализация ключевых слов
  setTimeout(async () => {
    await loadKeywords();
  }, 100);

  // Обновляем состояние крестика после загрузки
  setTimeout(() => {
    updateKeywordsInputState();
  }, 100);

  // Обработчик для кнопки "Удалить все"
  const clearAllKeywordsBtn = document.getElementById('clear-all-keywords-btn');
  if (clearAllKeywordsBtn) {
    clearAllKeywordsBtn.addEventListener('click', async () => {
      if (currentKeywords.length === 0) {
        uiToast('Нет ключевых слов для удаления');
        return;
      }
      
      if (confirm(`Удалить все ${currentKeywords.length} ключевых слов?`)) {
        currentKeywords = [];
        displayKeywordTags();
        updateKeywordsCount();
        
        // Сохраняем пустой список в базу
        try {
          const response = await fetch(`${API_ENDPOINTS.SETTINGS}?update_key=eq.1`, {
            method: 'PATCH',
            headers: {
          'apikey': CFG?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CFG?.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
            body: JSON.stringify({ keywords: '' })
          });
          
          if (!response.ok && response.status !== 404) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          uiToast('Все ключевые слова удалены');
        } catch (error) {
          console.error('Ошибка сохранения пустого списка:', error);
          uiToast('Ошибка сохранения изменений');
        }
      }
    });
  }

  // Обработчик для добавления ключевых слов пачкой
  const addBatchBtn = document.getElementById('add-batch-btn');
  if (addBatchBtn) {
    addBatchBtn.addEventListener('click', () => {
      const batchInput = document.getElementById('batch-keywords-input');
      if (batchInput && batchInput.value.trim()) {
        const keywords = batchInput.value
          .split(/[,\n\s]+/)
          .map(k => k.trim())
          .filter(k => k);
        
        if (keywords.length > 0) {
          keywords.forEach(keyword => {
            if (keyword) addKeyword(keyword);
          });
          
          batchInput.value = '';
          uiToast(`Добавлено ${keywords.length} ключевых слов`);
        }
      }
    });
  }

  // Обработчик для добавления канала
  if (addChannelBtn) {
    addChannelBtn.addEventListener('click', async () => {
      const channelId = validateAndFormatChannelId(channelInput?.value);
      if (channelId) {
        await addChannel();
        // Обновляем интерфейс после добавления
        setTimeout(() => {
          updateDeleteSelectedButton();
        }, 100);
      }
    });
  }



  // Обработчик для кнопки очистки поля ввода
  const keywordsClearBtn = document.getElementById('keywords-clear-button');
  if (keywordsClearBtn) {
    keywordsClearBtn.addEventListener('click', () => {
      if (newKeywordInput) {
        newKeywordInput.value = '';
        newKeywordInput.focus();
        // Обновляем состояние крестика
        updateKeywordsInputState();
      }
    });
  }

  // Обработчики для обновления состояния крестика
  if (newKeywordInput) {
    // При вводе текста
    newKeywordInput.addEventListener('input', () => {
      updateKeywordsInputState();
    });
    
    // При фокусе
    newKeywordInput.addEventListener('focus', () => {
      updateKeywordsInputState();
    });
  }







  // Обработчик для Enter в поле добавления канала
  if (channelInput) {
    channelInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const channelId = validateAndFormatChannelId(channelInput.value);
        if (channelId) {
          addChannel();
          setTimeout(() => {
            updateDeleteSelectedButton();
          }, 100);
        }
      }
    });
  }

  // Обработчик для кликабельных примеров
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('example-btn')) {
      const example = e.target.dataset.example;
      if (channelInput && example) {
        channelInput.value = example;
        channelInput.focus();
        // Обновляем состояние крестика
        updateChannelsInputState();
      }
    }
  });

  // Функция обновления состояния крестика для каналов
  function updateChannelsInputState() {
    const channelsInputWrapper = document.querySelector('.channels-input-wrapper');
    if (channelsInputWrapper && channelInput) {
      const hasText = channelInput.value.length > 0;
      channelsInputWrapper.classList.toggle('has-text', hasText);
    }
  }

  // Обработчик для кнопки очистки каналов
  const channelsClearBtn = document.getElementById('channels-clear-button');
  if (channelsClearBtn) {
    channelsClearBtn.addEventListener('click', () => {
      if (channelInput) {
        channelInput.value = '';
        channelInput.focus();
        updateChannelsInputState();
      }
    });
  }

  // Обработчик для ввода в поле каналов
  if (channelInput) {
    channelInput.addEventListener('input', updateChannelsInputState);
    channelInput.addEventListener('focus', updateChannelsInputState);
  }

  // Инициализация состояния крестика при загрузке
  updateChannelsInputState();
})();
