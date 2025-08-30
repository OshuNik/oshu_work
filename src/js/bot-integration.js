/**
 * Telegram Bot Integration - Phase 3.2
 * Интеграция с Telegram Bot API для уведомлений
 */

class TelegramBotIntegration {
  constructor() {
    this.botToken = null;
    this.userId = null;
    this.chatId = null;
    this.isEnabled = false;
    
    // Настройки уведомлений по умолчанию
    this.notificationSettings = {
      newVacancies: true,
      favoriteUpdates: true,
      categoryFilter: 'all', // all|main|maybe|other
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      },
      enabled: true
    };
    
    // API endpoints (mock для разработки)
    this.apiEndpoints = {
      webhook: '/api/telegram/webhook',
      sendMessage: '/api/telegram/send-message',
      setSettings: '/api/telegram/settings'
    };
    
    this.init();
  }

  /**
   * Инициализация Bot интеграции
   */
  async init() {
    try {
      // Получаем данные пользователя из Telegram WebApp
      await this.initializeTelegramUser();
      
      // Загружаем сохраненные настройки
      await this.loadNotificationSettings();
      
      // Настраиваем слушатели событий
      this.setupEventListeners();
      
      console.log('[Bot Integration] Инициализирован для пользователя:', this.userId);
      
    } catch (error) {
      console.error('[Bot Integration] Ошибка инициализации:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Инициализация данных пользователя Telegram
   */
  async initializeTelegramUser() {
    if (!window.Telegram?.WebApp) {
      throw new Error('Telegram WebApp API недоступен');
    }

    const tg = window.Telegram.WebApp;
    
    // Получаем данные пользователя
    if (tg.initDataUnsafe?.user) {
      const user = tg.initDataUnsafe.user;
      this.userId = user.id;
      this.chatId = user.id; // В Mini App чат ID = user ID
      
      console.log('[Bot Integration] Пользователь Telegram:', {
        id: this.userId,
        username: user.username,
        first_name: user.first_name
      });
      
      this.isEnabled = true;
    } else {
      console.warn('[Bot Integration] Данные пользователя недоступны');
      
      // Fallback для разработки
      if (window.location.hostname === 'localhost') {
        this.userId = 'dev_user_123';
        this.chatId = 'dev_user_123';
        this.isEnabled = true;
        console.log('[Bot Integration] Режим разработки активирован');
      }
    }
  }

  /**
   * Загрузка настроек уведомлений
   */
  async loadNotificationSettings() {
    try {
      // Загружаем из localStorage
      const saved = localStorage.getItem('telegramNotificationSettings');
      if (saved) {
        this.notificationSettings = {
          ...this.notificationSettings,
          ...JSON.parse(saved)
        };
      }

      // Дополнительно загружаем с сервера (если доступно)
      await this.loadServerSettings();
      
      console.log('[Bot Integration] Настройки загружены:', this.notificationSettings);
      
    } catch (error) {
      console.warn('[Bot Integration] Не удалось загрузить настройки:', error);
    }
  }

  /**
   * Загрузка настроек с сервера
   */
  async loadServerSettings() {
    if (!this.isEnabled) return;

    try {
      const response = await fetch(`${this.apiEndpoints.setSettings}?userId=${this.userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': this.userId
        }
      });

      if (response.ok) {
        const serverSettings = await response.json();
        this.notificationSettings = {
          ...this.notificationSettings,
          ...serverSettings
        };
      }
    } catch (error) {
      console.warn('[Bot Integration] Сервер настроек недоступен:', error);
    }
  }

  /**
   * Настройка слушателей событий
   */
  setupEventListeners() {
    // Слушаем события новых вакансий
    document.addEventListener('vacancy:new', (event) => {
      if (this.shouldSendNotification('newVacancies', event.detail)) {
        this.sendVacancyNotification('new', event.detail);
      }
    });

    // Обновления в избранном
    document.addEventListener('favorite:added', (event) => {
      if (this.shouldSendNotification('favoriteUpdates')) {
        this.sendFavoriteNotification('added', event.detail);
      }
    });

    document.addEventListener('favorite:removed', (event) => {
      if (this.shouldSendNotification('favoriteUpdates')) {
        this.sendFavoriteNotification('removed', event.detail);
      }
    });

    // Изменения настроек уведомлений
    document.addEventListener('notification-settings-changed', (event) => {
      this.updateNotificationSettings(event.detail);
    });
  }

  /**
   * Проверка нужно ли отправлять уведомление
   */
  shouldSendNotification(type, vacancyData = null) {
    // Основная проверка включенности
    if (!this.isEnabled || !this.notificationSettings.enabled || !this.notificationSettings[type]) {
      return false;
    }

    // Проверка тихих часов
    if (this.isQuietTime()) {
      return false;
    }

    // Проверка фильтра категорий для вакансий
    if (vacancyData && this.notificationSettings.categoryFilter !== 'all') {
      const filterMap = {
        main: 'ТОЧНО ТВОЁ',
        maybe: 'МОЖЕТ БЫТЬ', 
        other: 'НЕ ТВОЁ'
      };
      
      const allowedCategory = filterMap[this.notificationSettings.categoryFilter];
      if (allowedCategory && vacancyData.category !== allowedCategory) {
        return false;
      }
    }

    return true;
  }

  /**
   * Проверка тихих часов
   */
  isQuietTime() {
    if (!this.notificationSettings.quietHours.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const startTime = this.parseTime(this.notificationSettings.quietHours.start);
    const endTime = this.parseTime(this.notificationSettings.quietHours.end);
    
    // Проверяем период через полночь
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }

  /**
   * Парсинг времени "HH:MM" в минуты
   */
  parseTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Отправка уведомления о вакансии
   */
  async sendVacancyNotification(type, vacancyData) {
    let message = '';
    let keyboard = null;

    switch (type) {
      case 'new':
        message = this.formatNewVacancyMessage(vacancyData);
        keyboard = this.createVacancyKeyboard(vacancyData);
        break;
      case 'updated':
        message = this.formatUpdatedVacancyMessage(vacancyData);
        keyboard = this.createVacancyKeyboard(vacancyData);
        break;
    }

    if (message) {
      await this.sendMessage(message, keyboard);
    }
  }

  /**
   * Форматирование сообщения о новой вакансии
   */
  formatNewVacancyMessage(vacancy) {
    const emoji = this.getCategoryEmoji(vacancy.category);
    
    let message = `${emoji} *Новая вакансия!*\n\n`;
    message += `*${vacancy.title || 'Без названия'}*\n`;
    
    if (vacancy.company) {
      message += `🏢 ${vacancy.company}\n`;
    }
    
    if (vacancy.salary) {
      message += `💰 ${vacancy.salary}\n`;
    }
    
    message += `📂 ${vacancy.category}\n`;
    
    if (vacancy.description) {
      const shortDesc = vacancy.description.length > 100 
        ? vacancy.description.substring(0, 100) + '...'
        : vacancy.description;
      message += `\n${shortDesc}`;
    }

    return message;
  }

  /**
   * Форматирование сообщения об обновлении вакансии
   */
  formatUpdatedVacancyMessage(vacancy) {
    return `🔄 *Обновлена вакансия*\n\n*${vacancy.title}*\n🏢 ${vacancy.company || 'Компания не указана'}`;
  }

  /**
   * Получение эмодзи для категории
   */
  getCategoryEmoji(category) {
    const emojiMap = {
      'ТОЧНО ТВОЁ': '🎯',
      'МОЖЕТ БЫТЬ': '🤔',
      'НЕ ТВОЁ': '🚫'
    };
    return emojiMap[category] || '📝';
  }

  /**
   * Создание клавиатуры для вакансии
   */
  createVacancyKeyboard(vacancy) {
    return {
      inline_keyboard: [
        [
          { 
            text: '📱 Открыть в приложении', 
            web_app: { url: `${window.location.origin}/?vacancy=${vacancy.id}` }
          }
        ],
        [
          { text: '⭐ Добавить в избранное', callback_data: `fav_${vacancy.id}` },
          { text: '📧 Откликнуться', callback_data: `apply_${vacancy.id}` }
        ],
        [
          { text: '⚙️ Настройки уведомлений', callback_data: 'settings_notifications' }
        ]
      ]
    };
  }

  /**
   * Отправка уведомления об избранном
   */
  async sendFavoriteNotification(action, vacancy) {
    const actionText = action === 'added' ? 'добавлена в' : 'удалена из';
    const emoji = action === 'added' ? '⭐' : '🗑️';
    
    const message = `${emoji} Вакансия *${vacancy.title}* ${actionText} избранного`;
    
    await this.sendMessage(message);
  }

  /**
   * Отправка сообщения через Bot API
   */
  async sendMessage(text, keyboard = null) {
    if (!this.isEnabled || !this.chatId) {
      console.warn('[Bot Integration] Отправка сообщения невозможна - нет chatId');
      return false;
    }

    const messageData = {
      chat_id: this.chatId,
      text: text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    };

    if (keyboard) {
      messageData.reply_markup = keyboard;
    }

    try {
      // В режиме разработки просто логируем
      if (window.location.hostname === 'localhost') {
        console.log('[Bot Integration] DEV: Отправка сообщения:', messageData);
        this.showDevNotification(text);
        return true;
      }

      // Отправляем через API
      const response = await fetch(this.apiEndpoints.sendMessage, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': this.userId
        },
        body: JSON.stringify(messageData)
      });

      if (response.ok) {
        console.log('[Bot Integration] Уведомление отправлено');
        return true;
      } else {
        console.error('[Bot Integration] Ошибка отправки:', response.status);
        return false;
      }
      
    } catch (error) {
      console.error('[Bot Integration] Ошибка API:', error);
      return false;
    }
  }

  /**
   * Показ dev уведомления для режима разработки
   */
  showDevNotification(message) {
    // Создаем элемент уведомления для разработки
    const notification = document.createElement('div');
    notification.className = 'dev-bot-notification';
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      max-width: 300px;
      background: #0088cc;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.4;
      z-index: 10000;
      opacity: 0;
      transform: translateY(20px);
      transition: all 300ms ease;
      white-space: pre-line;
    `;

    // Убираем Markdown для отображения
    const plainText = message.replace(/\*([^*]+)\*/g, '$1');
    notification.textContent = `🤖 Bot: ${plainText}`;

    document.body.appendChild(notification);

    // Анимация появления
    requestAnimationFrame(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateY(0)';
    });

    // Автоскрытие через 5 секунд
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(20px)';
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }

  /**
   * Обновление настроек уведомлений
   */
  async updateNotificationSettings(newSettings) {
    // Обновляем локальные настройки
    this.notificationSettings = {
      ...this.notificationSettings,
      ...newSettings
    };

    // Сохраняем в localStorage
    try {
      localStorage.setItem('telegramNotificationSettings', 
        JSON.stringify(this.notificationSettings));
    } catch (error) {
      console.warn('[Bot Integration] Не удалось сохранить настройки локально:', error);
    }

    // Отправляем на сервер
    await this.saveServerSettings();
    
    console.log('[Bot Integration] Настройки обновлены:', this.notificationSettings);
    
    // Отправляем подтверждение
    if (newSettings.enabled !== undefined) {
      const status = newSettings.enabled ? 'включены' : 'отключены';
      await this.sendMessage(`⚙️ Уведомления ${status}`);
    }
  }

  /**
   * Сохранение настроек на сервер
   */
  async saveServerSettings() {
    if (!this.isEnabled) return;

    try {
      const response = await fetch(this.apiEndpoints.setSettings, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': this.userId
        },
        body: JSON.stringify({
          userId: this.userId,
          settings: this.notificationSettings
        })
      });

      if (!response.ok) {
        console.warn('[Bot Integration] Не удалось сохранить настройки на сервере');
      }
    } catch (error) {
      console.warn('[Bot Integration] Сервер настроек недоступен:', error);
    }
  }

  /**
   * Включение/отключение уведомлений
   */
  async setEnabled(enabled) {
    await this.updateNotificationSettings({ enabled });
  }

  /**
   * Настройка фильтра категорий
   */
  async setCategoryFilter(filter) {
    await this.updateNotificationSettings({ categoryFilter: filter });
  }

  /**
   * Настройка тихих часов
   */
  async setQuietHours(enabled, startTime = '22:00', endTime = '08:00') {
    await this.updateNotificationSettings({
      quietHours: {
        enabled,
        start: startTime,
        end: endTime
      }
    });
  }

  /**
   * Настройка типов уведомлений
   */
  async setNotificationTypes(types) {
    const validTypes = ['newVacancies', 'favoriteUpdates'];
    const updates = {};
    
    validTypes.forEach(type => {
      if (types.hasOwnProperty(type)) {
        updates[type] = types[type];
      }
    });
    
    await this.updateNotificationSettings(updates);
  }

  /**
   * Тест уведомления
   */
  async testNotification() {
    const testMessage = `🧪 *Тест уведомлений*\n\nЭто тестовое сообщение для проверки работы уведомлений.\n\n✅ Уведомления работают корректно!`;
    
    return await this.sendMessage(testMessage, {
      inline_keyboard: [
        [{ text: '⚙️ Настройки уведомлений', callback_data: 'settings_notifications' }]
      ]
    });
  }

  /**
   * Получение текущих настроек
   */
  getSettings() {
    return { ...this.notificationSettings };
  }

  /**
   * Получение статуса интеграции
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      userId: this.userId,
      chatId: this.chatId,
      settings: this.notificationSettings,
      quietTime: this.isQuietTime()
    };
  }

  /**
   * Обработка callback от бота
   */
  handleBotCallback(callbackData, messageId) {
    console.log('[Bot Integration] Callback получен:', callbackData);
    
    if (callbackData.startsWith('fav_')) {
      const vacancyId = callbackData.replace('fav_', '');
      this.handleFavoriteCallback(vacancyId, messageId);
    } else if (callbackData.startsWith('apply_')) {
      const vacancyId = callbackData.replace('apply_', '');
      this.handleApplyCallback(vacancyId, messageId);
    } else if (callbackData === 'settings_notifications') {
      this.handleSettingsCallback(messageId);
    }
  }

  /**
   * Обработка добавления в избранное через бот
   */
  async handleFavoriteCallback(vacancyId, messageId) {
    // Эмулируем добавление в избранное
    document.dispatchEvent(new CustomEvent('bot-favorite-request', {
      detail: { vacancyId, messageId }
    }));
  }

  /**
   * Обработка отклика через бот
   */
  async handleApplyCallback(vacancyId, messageId) {
    // Эмулируем отклик на вакансию
    document.dispatchEvent(new CustomEvent('bot-apply-request', {
      detail: { vacancyId, messageId }
    }));
  }

  /**
   * Обработка запроса настроек
   */
  async handleSettingsCallback(messageId) {
    const settingsMessage = this.formatSettingsMessage();
    const keyboard = this.createSettingsKeyboard();
    
    await this.sendMessage(settingsMessage, keyboard);
  }

  /**
   * Форматирование сообщения настроек
   */
  formatSettingsMessage() {
    const settings = this.notificationSettings;
    
    let message = '⚙️ *Настройки уведомлений*\n\n';
    message += `Статус: ${settings.enabled ? '✅ Включены' : '❌ Отключены'}\n`;
    message += `Новые вакансии: ${settings.newVacancies ? '✅' : '❌'}\n`;
    message += `Обновления избранного: ${settings.favoriteUpdates ? '✅' : '❌'}\n`;
    
    const filterMap = {
      all: 'Все категории',
      main: 'Только "Точно твоё"',
      maybe: 'Только "Может быть"',
      other: 'Только "Не твоё"'
    };
    message += `Фильтр: ${filterMap[settings.categoryFilter]}\n`;
    
    if (settings.quietHours.enabled) {
      message += `Тихие часы: ${settings.quietHours.start} - ${settings.quietHours.end}\n`;
    } else {
      message += `Тихие часы: Отключены\n`;
    }
    
    return message;
  }

  /**
   * Создание клавиатуры настроек
   */
  createSettingsKeyboard() {
    return {
      inline_keyboard: [
        [{ text: '📱 Открыть настройки в приложении', web_app: { url: `${window.location.origin}/settings.html` } }],
        [{ text: '🧪 Тест уведомлений', callback_data: 'test_notification' }]
      ]
    };
  }
}

// Глобальный экспорт
window.TelegramBotIntegration = TelegramBotIntegration;

// Создаем глобальный экземпляр
window.botIntegration = new TelegramBotIntegration();

console.log('[Phase 3.2] Telegram Bot Integration инициализирован');