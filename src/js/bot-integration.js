/**
 * Simple Telegram Bot Notifications - Phase 3.2 Simplified
 * Простые уведомления для Telegram Mini App
 */

class SimpleBotNotifications {
  constructor() {
    // Простые настройки
    this.settings = {
      enabled: localStorage.getItem('notifications-enabled') === 'true',
      categoryFilter: localStorage.getItem('notifications-category') || 'all' // all|main|maybe|other
    };
    
    this.init();
  }

  /**
   * Инициализация
   */
  init() {
    console.log('[Simple Bot] Инициализирован с настройками:', this.settings);
    
    // Настраиваем UI кнопку если мы на странице настроек
    this.setupNotificationButton();
    
    // Слушаем события новых вакансий (только если включено)
    if (this.settings.enabled) {
      this.setupEventListeners();
    }
  }

  /**
   * Настройка кнопки уведомлений в settings.html
   */
  setupNotificationButton() {
    const button = document.getElementById('notifications-toggle');
    if (!button) return;

    // Устанавливаем начальное состояние кнопки
    this.updateButtonState(button);

    // Обычный клик - переключение вкл/выкл
    button.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleNotifications();
      this.updateButtonState(button);
    });

    // Долгое нажатие - меню выбора категории
    let longPressTimer;
    let isLongPress = false;

    button.addEventListener('mousedown', () => {
      isLongPress = false;
      
      // Добавляем класс для анимации заливки
      button.classList.add('long-pressing');
      
      longPressTimer = setTimeout(() => {
        isLongPress = true;
        this.showCategoryMenu();
      }, 800); // 800ms для долгого нажатия
    });

    button.addEventListener('mouseup', () => {
      clearTimeout(longPressTimer);
      // Убираем класс анимации заливки
      button.classList.remove('long-pressing');
    });

    button.addEventListener('mouseleave', () => {
      clearTimeout(longPressTimer);
      // Убираем класс анимации заливки
      button.classList.remove('long-pressing');
    });

    // Для мобильных устройств
    button.addEventListener('touchstart', (e) => {
      e.preventDefault();
      isLongPress = false;
      
      // Добавляем класс для анимации заливки
      button.classList.add('long-pressing');
      
      longPressTimer = setTimeout(() => {
        isLongPress = true;
        this.showCategoryMenu();
        // Вибрация при долгом нажатии
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }, 800);
    });

    button.addEventListener('touchend', (e) => {
      e.preventDefault();
      clearTimeout(longPressTimer);
      
      // Убираем класс анимации заливки
      button.classList.remove('long-pressing');
      
      // Если это не было долгое нажатие - делаем обычный клик
      if (!isLongPress) {
        setTimeout(() => {
          this.toggleNotifications();
          this.updateButtonState(button);
        }, 50);
      }
    });
  }

  /**
   * Переключение уведомлений вкл/выкл
   */
  toggleNotifications() {
    this.settings.enabled = !this.settings.enabled;
    localStorage.setItem('notifications-enabled', this.settings.enabled.toString());
    
    if (this.settings.enabled) {
      this.setupEventListeners();
      this.showToast('🔔 Уведомления включены');
    } else {
      this.showToast('🔕 Уведомления выключены');
    }
  }

  /**
   * Обновление внешнего вида кнопки
   */
  updateButtonState(button) {
    const icon = button.querySelector('i');
    
    if (this.settings.enabled) {
      button.classList.remove('disabled');
      icon.className = 'bi bi-bell-fill';
      button.title = 'Уведомления включены (долгий клик - настройки)';
    } else {
      button.classList.add('disabled');
      icon.className = 'bi bi-bell-slash';
      button.title = 'Уведомления выключены (клик - включить)';
    }
  }

  /**
   * Показ меню выбора категории при долгом нажатии
   */
  showCategoryMenu() {
    const categories = [
      { id: 'all', name: 'Все категории', emoji: '📝' },
      { id: 'main', name: 'Точно твоё', emoji: '🎯' },
      { id: 'maybe', name: 'Может быть', emoji: '🤔' },
      { id: 'other', name: 'Не твоё', emoji: '🚫' }
    ];

    // Создаем простое модальное окно
    const overlay = document.createElement('div');
    overlay.className = 'notification-menu-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 200ms ease;
    `;

    const menu = document.createElement('div');
    menu.className = 'notification-category-menu';
    menu.style.cssText = `
      background: var(--card-color);
      border: var(--border-width) solid var(--border-color);
      border-radius: 8px;
      padding: 20px;
      max-width: 280px;
      width: 90%;
      box-shadow: var(--box-shadow);
      transform: scale(0.9);
      transition: transform 200ms ease;
    `;

    let menuHTML = '<h3 style="margin-top: 0; font-family: var(--font-pixel); font-size: 14px;">УВЕДОМЛЕНИЯ ИЗ:</h3>';
    
    categories.forEach(category => {
      const isActive = this.settings.categoryFilter === category.id;
      menuHTML += `
        <div class="category-option ${isActive ? 'active' : ''}" data-category="${category.id}" 
             style="
               padding: 12px;
               margin: 8px 0;
               border: 2px solid ${isActive ? 'var(--accent-green)' : 'var(--border-color)'};
               border-radius: 6px;
               cursor: pointer;
               display: flex;
               align-items: center;
               gap: 10px;
               font-family: var(--font-mono);
               background: ${isActive ? 'var(--accent-green)' : 'var(--card-color)'};
               color: ${isActive ? 'white' : 'var(--text-color)'};
               transition: all 150ms ease;
             ">
          <span style="font-size: 16px;">${category.emoji}</span>
          <span>${category.name}</span>
        </div>
      `;
    });

    menu.innerHTML = menuHTML;
    overlay.appendChild(menu);
    document.body.appendChild(overlay);

    // Анимация появления
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      menu.style.transform = 'scale(1)';
    });

    // Обработчики кликов
    menu.addEventListener('click', (e) => {
      const option = e.target.closest('.category-option');
      if (option) {
        const category = option.dataset.category;
        this.setCategoryFilter(category);
        this.closeMenu(overlay);
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeMenu(overlay);
      }
    });
  }

  /**
   * Закрытие меню категорий
   */
  closeMenu(overlay) {
    overlay.style.opacity = '0';
    const menu = overlay.querySelector('.notification-category-menu');
    menu.style.transform = 'scale(0.9)';
    
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 200);
  }

  /**
   * Установка фильтра категории
   */
  setCategoryFilter(category) {
    this.settings.categoryFilter = category;
    localStorage.setItem('notifications-category', category);
    
    const categoryNames = {
      all: 'всех категорий',
      main: 'категории "Точно твоё"',
      maybe: 'категории "Может быть"',
      other: 'категории "Не твоё"'
    };
    
    this.showToast(`📂 Уведомления из ${categoryNames[category]}`);
  }

  /**
   * Настройка слушателей событий
   */
  setupEventListeners() {
    // Слушаем события новых вакансий
    document.addEventListener('vacancy:new', (event) => {
      if (this.shouldShowNotification(event.detail)) {
        this.showVacancyNotification(event.detail);
      }
    });
  }

  /**
   * Проверка нужно ли показывать уведомление
   */
  shouldShowNotification(vacancy) {
    if (!this.settings.enabled) return false;
    
    // Проверяем фильтр категории
    if (this.settings.categoryFilter !== 'all') {
      const categoryMap = {
        main: 'ТОЧНО ТВОЁ',
        maybe: 'МОЖЕТ БЫТЬ',
        other: 'НЕ ТВОЁ'
      };
      
      const allowedCategory = categoryMap[this.settings.categoryFilter];
      if (vacancy.category !== allowedCategory) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Показ уведомления о вакансии
   */
  showVacancyNotification(vacancy) {
    console.log('🔔 [Bot Integration] Попытка отправить уведомление:', {
      vacancy: vacancy.title || 'Без названия',
      category: vacancy.category,
      enabled: this.settings.enabled,
      filter: this.settings.categoryFilter,
      shouldShow: this.shouldShowNotification(vacancy)
    });

    // Отправляем уведомление через Telegram Bot API
    this.sendTelegramBotNotification(vacancy);

    // В режиме разработки показываем как toast
    if (window.location.hostname === 'localhost') {
      const emoji = this.getCategoryEmoji(vacancy.category);
      this.showToast(`${emoji} Новая вакансия: ${vacancy.title || 'Без названия'}`, 4000);
      console.log('✅ [Bot Integration] Toast уведомление показано (localhost)');
    }
  }

  /**
   * Отправка уведомления через Telegram Bot API
   */
  async sendTelegramBotNotification(vacancy) {
    try {
      console.log('📱 [Bot Integration] Отправка уведомления через Telegram Bot...');

      // Определяем URL API (в production это будет URL парсера на Amvera)
      const apiUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api/send-notification'  // Для тестов
        : 'https://your-amvera-domain.com/api/send-notification'; // Замените на ваш домен

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vacancy: {
            id: vacancy.id,
            title: vacancy.title || vacancy.reason || 'Без названия',
            company: vacancy.company_name || vacancy.company || '',
            industry: vacancy.industry || '',
            category: vacancy.category || vacancy.ai_category || 'НЕ ТВОЁ',
            reason: vacancy.reason || '',
            text: vacancy.text || vacancy.text_highlighted || ''
          },
          category_filter: this.settings.categoryFilter,
          enabled: this.settings.enabled
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ [Bot Integration] Уведомление отправлено через Telegram Bot');
      } else {
        console.warn('⚠️ [Bot Integration] Уведомление не отправлено:', result.reason);
      }

    } catch (error) {
      console.error('❌ [Bot Integration] Ошибка отправки уведомления:', error);
      console.log('📱 [Bot Integration] Используем fallback - уведомление только в приложении');
    }
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
   * Показ toast уведомления
   */
  showToast(message, duration = 2500) {
    // Удаляем предыдущий toast если есть
    const existingToast = document.querySelector('.simple-toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'simple-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: var(--card-color);
      color: var(--text-color);
      padding: 12px 20px;
      border-radius: 8px;
      border: 2px solid var(--border-color);
      box-shadow: var(--box-shadow);
      font-family: var(--font-mono);
      font-size: 14px;
      z-index: 10001;
      opacity: 0;
      transition: all 300ms ease;
      max-width: 90%;
      text-align: center;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);

    // Анимация появления
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    // Автоскрытие
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-20px)';
      
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  }

  /**
   * Получение настроек
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Получение статуса для совместимости со старым кодом
   */
  getStatus() {
    return {
      enabled: this.settings.enabled,
      userId: 'simplified_user',
      chatId: 'simplified_user',
      settings: this.settings,
      quietTime: false
    };
  }
}

// Глобальный экспорт
window.SimpleBotNotifications = SimpleBotNotifications;

// Создаем глобальный экземпляр
window.botIntegration = new SimpleBotNotifications();

console.log('[Phase 3.2] Simple Bot Notifications инициализирован');