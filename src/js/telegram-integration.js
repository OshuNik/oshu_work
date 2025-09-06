/**
 * Telegram Mini App Integration
 * Управление всеми Telegram-specific возможностями
 */

class TelegramIntegration {
  constructor() {
    this.tg = window.Telegram?.WebApp;
    this.isReady = false;
    this.callbacks = new Map();
    this.apiVersion = null;
    
    if (!this.tg) {
      console.warn('Telegram WebApp API недоступен');
      return;
    }

    // Определяем версию API
    this.detectApiVersion();
    this.init();
  }

  detectApiVersion() {
    if (!this.tg) return;

    // Определяем версию по доступным методам/свойствам
    if (this.tg.version) {
      this.apiVersion = this.tg.version;
      logger.log(`📱 Telegram WebApp API версия: ${this.apiVersion}`);
    } else {
      // Fallback определение версии по возможностям
      if (this.tg.SettingsButton) {
        this.apiVersion = '6.1+';
      } else {
        this.apiVersion = '6.0';
      }
      logger.log(`📱 Telegram WebApp API версия (определена): ${this.apiVersion}`);
    }

    // Логируем доступные возможности
    const capabilities = {
      SettingsButton: !!this.tg.SettingsButton,
      enableClosingConfirmation: typeof this.tg.enableClosingConfirmation === 'function',
      HapticFeedback: !!this.tg.HapticFeedback,
      MainButton: !!this.tg.MainButton,
      BackButton: !!this.tg.BackButton
    };
    
    logger.log('🔍 Доступные возможности:', capabilities);
  }

  async init() {
    try {
      // Расширяем Mini App на весь экран
      this.tg.expand();
      
      // Настраиваем тему
      this.setupTheme();
      
      // Настраиваем UI элементы
      this.setupUI();
      
      // Настраиваем обработчики событий
      this.setupEventHandlers();
      
      // Включаем closing confirmation только для поддерживаемых версий (6.2+)
      if (this.isClosingConfirmationSupported()) {
        try {
          this.tg.enableClosingConfirmation();
          logger.log('✅ Closing confirmation активирован');
        } catch (error) {
          console.warn('⚠️ Closing confirmation не поддерживается:', error.message);
        }
      } else {
        logger.log('ℹ️ Closing confirmation требует более новую версию Telegram WebApp API');
      }
      
      // Уведомляем о готовности
      this.tg.ready();
      this.isReady = true;
      
      logger.log('✅ Telegram Integration готов');
    } catch (error) {
      console.error('❌ Ошибка инициализации Telegram Integration:', error);
    }
  }

  setupTheme() {
    if (!this.tg) return;

    // Применяем цвета темы Telegram
    const themeParams = this.tg.themeParams;
    const root = document.documentElement;

    if (themeParams.bg_color) {
      root.style.setProperty('--tg-background-color', themeParams.bg_color);
      root.style.setProperty('--background-color', themeParams.bg_color);
    }

    if (themeParams.text_color) {
      root.style.setProperty('--tg-text-color', themeParams.text_color);
      root.style.setProperty('--text-color', themeParams.text_color);
    }

    if (themeParams.button_color) {
      root.style.setProperty('--tg-button-color', themeParams.button_color);
    }

    if (themeParams.button_text_color) {
      root.style.setProperty('--tg-button-text-color', themeParams.button_text_color);
    }

    // Специальная тема для темного режима
    if (themeParams.bg_color === '#212121' || themeParams.bg_color === '#17212b') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }

  setupUI() {
    if (!this.tg) return;

    // BackButton для навигации
    this.setupBackButton();
    
    // MainButton для основных действий
    this.setupMainButton();
    
    // SettingsButton если нужен
    this.setupSettingsButton();
  }

  setupBackButton() {
    // BackButton показываем только на внутренних страницах
    const currentPath = window.location.pathname;
    const isMainPage = currentPath.includes('index.html') || currentPath === '/' || currentPath.endsWith('/oshu_work/');
    
    if (!isMainPage) {
      this.tg.BackButton.show();
      this.tg.BackButton.onClick(() => {
        this.hapticFeedback('light');
        this.navigateBack();
      });
    }
  }

  setupMainButton() {
    // MainButton скрыт по умолчанию, показываем по требованию
    this.tg.MainButton.hide();
  }

  setupSettingsButton() {
    // SettingsButton для быстрого доступа к настройкам
    if (window.location.pathname.includes('settings.html')) {
      return; // Не показываем на странице настроек
    }

    // Строгая проверка версии API - только для 6.1+
    if (!this.tg.SettingsButton) {
      logger.log('ℹ️ SettingsButton не поддерживается в Telegram WebApp API версии ' + (this.apiVersion || 'неизвестной'));
      return;
    }

    // Дополнительная проверка версии через парсинг
    if (this.apiVersion && this.apiVersion !== '6.1+') {
      const version = parseFloat(this.apiVersion);
      if (version && version < 6.1) {
        logger.log('ℹ️ SettingsButton требует Telegram WebApp API версии 6.1 или выше');
        return;
      }
    }

    // Только если все проверки пройдены
    try {
      if (typeof this.tg.SettingsButton.show === 'function') {
        this.tg.SettingsButton.show();
        
        if (typeof this.tg.SettingsButton.onClick === 'function') {
          this.tg.SettingsButton.onClick(() => {
            this.hapticFeedback('light');
            this.navigateTo('settings.html');
          });
        }
        
        logger.log('✅ SettingsButton активирован');
      }
    } catch (error) {
      console.warn('⚠️ Ошибка при настройке SettingsButton:', error.message);
    }
  }

  setupEventHandlers() {
    if (!this.tg) return;

    // Обработка изменений темы
    this.tg.onEvent('themeChanged', () => {
      this.setupTheme();
    });

    // Обработка изменений viewport
    this.tg.onEvent('viewportChanged', (event) => {
      this.handleViewportChange(event);
    });

    // Обработка получения данных от бота
    this.tg.onEvent('settingsButtonClicked', () => {
      this.handleSettingsClick();
    });
  }

  // Навигация
  navigateTo(page) {
    const baseUrl = window.location.pathname.includes('oshu_work') ? '/oshu_work/' : '/';
    window.location.href = baseUrl + page;
  }

  navigateBack() {
    const baseUrl = window.location.pathname.includes('oshu_work') ? '/oshu_work/' : '/';
    
    // Определяем куда возвращаться
    const currentPath = window.location.pathname;
    if (currentPath.includes('favorites.html') || currentPath.includes('settings.html')) {
      window.location.href = baseUrl + 'index.html';
    } else {
      window.history.back();
    }
  }

  // Проверка поддержки closing confirmation
  isClosingConfirmationSupported() {
    if (!this.tg || typeof this.tg.enableClosingConfirmation !== 'function') {
      return false;
    }

    // Проверяем версию API
    if (this.apiVersion) {
      const version = parseFloat(this.apiVersion);
      if (version && version < 6.2) {
        return false;
      }
    }

    return true;
  }

  // Haptic Feedback
  hapticFeedback(type = 'light') {
    if (!this.tg?.HapticFeedback) return;

    switch (type) {
      case 'light':
        this.tg.HapticFeedback.impactOccurred('light');
        break;
      case 'medium':
        this.tg.HapticFeedback.impactOccurred('medium');
        break;
      case 'heavy':
        this.tg.HapticFeedback.impactOccurred('heavy');
        break;
      case 'success':
        this.tg.HapticFeedback.notificationOccurred('success');
        break;
      case 'warning':
        this.tg.HapticFeedback.notificationOccurred('warning');
        break;
      case 'error':
        this.tg.HapticFeedback.notificationOccurred('error');
        break;
    }
  }

  // MainButton управление
  showMainButton(text, callback) {
    if (!this.tg) return;

    this.tg.MainButton.setText(text);
    this.tg.MainButton.show();
    
    // Очищаем предыдущие обработчики
    this.tg.MainButton.offClick();
    
    this.tg.MainButton.onClick(() => {
      this.hapticFeedback('medium');
      callback && callback();
    });
  }

  hideMainButton() {
    if (!this.tg) return;
    this.tg.MainButton.hide();
  }

  setMainButtonLoading(isLoading) {
    if (!this.tg) return;
    
    if (isLoading) {
      this.tg.MainButton.showProgress();
    } else {
      this.tg.MainButton.hideProgress();
    }
  }

  // Отправка данных боту
  sendDataToBot(data) {
    if (!this.tg) return;

    try {
      this.tg.sendData(JSON.stringify(data));
      this.hapticFeedback('success');
    } catch (error) {
      console.error('❌ Ошибка отправки данных боту:', error);
      this.hapticFeedback('error');
    }
  }

  // Уведомления для бота
  setupNotificationPreferences(preferences) {
    this.sendDataToBot({
      type: 'notification_setup',
      data: {
        categories: preferences.categories || [],
        keywords: preferences.keywords || [],
        salary_min: preferences.salaryMin || 0,
        schedule: preferences.schedule || 'all_day',
        enabled: preferences.enabled !== false
      },
      timestamp: Date.now()
    });
  }

  subscribeToJob(jobId, jobTitle) {
    this.sendDataToBot({
      type: 'job_subscribe',
      data: {
        job_id: jobId,
        job_title: jobTitle,
        action: 'subscribe'
      },
      timestamp: Date.now()
    });
  }

  unsubscribeFromJob(jobId) {
    this.sendDataToBot({
      type: 'job_subscribe', 
      data: {
        job_id: jobId,
        action: 'unsubscribe'
      },
      timestamp: Date.now()
    });
  }

  // Информация о пользователе
  getUserInfo() {
    if (!this.tg?.initDataUnsafe?.user) return null;

    return {
      id: this.tg.initDataUnsafe.user.id,
      first_name: this.tg.initDataUnsafe.user.first_name,
      last_name: this.tg.initDataUnsafe.user.last_name,
      username: this.tg.initDataUnsafe.user.username,
      language_code: this.tg.initDataUnsafe.user.language_code,
      is_premium: this.tg.initDataUnsafe.user.is_premium
    };
  }

  // Utility methods
  handleViewportChange(event) {
    // Обработка изменений размера окна в Telegram
    const { height, is_expanded } = event;
    
    // Уведомляем компоненты об изменении viewport
    document.dispatchEvent(new CustomEvent('telegramViewportChanged', {
      detail: { height, is_expanded }
    }));
  }

  handleSettingsClick() {
    this.navigateTo('settings.html');
  }

  // Проверки
  isInTelegram() {
    return !!this.tg;
  }

  isReady() {
    return this.isReady;
  }

  // Закрытие приложения
  close() {
    if (this.tg) {
      this.tg.close();
    }
  }
}

// Глобальная инициализация
window.telegramIntegration = new TelegramIntegration();

export default window.telegramIntegration;