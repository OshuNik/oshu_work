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

    // ✅ BUG FIX: Отслеживание handlers для очистки
    this.eventHandlers = new Map();
    this.pendingTimeouts = new Set();

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
    // ✅ BUG FIX: Сохранили handler для возможности его удаления
    const vacancyHandler = (event) => {
      if (this.shouldShowNotification(event.detail)) {
        this.showVacancyNotification(event.detail);
      }
    };

    // Слушаем события новых вакансий
    document.addEventListener('vacancy:new', vacancyHandler);

    // Сохраняем в Map для удаления в destroy()
    this.eventHandlers.set('vacancy:new', vacancyHandler);
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
   * Получение динамического Telegram User ID
   */
  getTelegramUserId() {
    try {
      // Первый приоритет: telegramIntegration (если доступен)
      if (window.telegramIntegration && typeof window.telegramIntegration.getUserInfo === 'function') {
        try {
          const userInfo = window.telegramIntegration.getUserInfo();
          if (userInfo && userInfo.id) {
            const userId = String(userInfo.id);
            console.log(`✅ [Bot Integration] Using dynamic Telegram user ID: ${userId}`);
            return userId;
          }
        } catch (err) {
          console.warn('[Bot Integration] Failed to get user ID from telegramIntegration:', err.message);
        }
      }

      // Второй приоритет: Telegram WebApp API (встроенный)
      if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
        const userId = String(window.Telegram.WebApp.initDataUnsafe.user.id);
        console.log(`✅ [Bot Integration] Using Telegram WebApp user ID: ${userId}`);
        return userId;
      }

      // Третий приоритет: попытка из initData
      if (window.Telegram?.WebApp?.initData) {
        try {
          const params = new URLSearchParams(window.Telegram.WebApp.initData);
          const userData = params.get('user');
          if (userData) {
            const user = JSON.parse(userData);
            if (user.id) {
              const userId = String(user.id);
              console.log(`✅ [Bot Integration] Using user ID from initData: ${userId}`);
              return userId;
            }
          }
        } catch (err) {
          console.warn('[Bot Integration] Failed to parse user from initData:', err.message);
        }
      }

      // Fallback: возвращаем идентификатор ошибки с логом
      console.warn('⚠️ [Bot Integration] Could not determine Telegram user ID from any source');
      return 'unknown_user';
    } catch (error) {
      console.error('❌ [Bot Integration] Error getting Telegram user ID:', error);
      return 'error_user';
    }
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
   * Отправка уведомления через Supabase (просто как с ошибками)
   */
  async sendTelegramBotNotification(vacancy) {
    try {
      console.log('📱 [Bot Integration] Сохранение уведомления в Supabase...');

      // Проверяем доступность Supabase клиента
      if (!window.supabaseClient) {
        console.error('❌ [Bot Integration] Supabase клиент недоступен');
        return;
      }

      // Получаем динамический Telegram User ID вместо hardcoded
      const userId = this.getTelegramUserId();

      // Сохраняем уведомление в таблицу notifications
      const { data, error } = await window.supabaseClient
        .from('notifications')
        .insert([
          {
            user_id: userId, // ✅ FIX: Dynamic user ID instead of hardcoded
            vacancy_id: vacancy.id,
            title: vacancy.title || vacancy.reason || 'Без названия',
            message: this.formatNotificationMessage(vacancy),
            category: vacancy.category || vacancy.ai_category || 'НЕ ТВОЁ',
            category_filter: this.settings.categoryFilter,
            enabled: this.settings.enabled,
            status: 'pending', // pending/sent/failed
            created_at: new Date().toISOString()
          }
        ]);

      if (error) {
        console.error('❌ [Bot Integration] Ошибка сохранения уведомления:', error);
      } else {
        console.log('✅ [Bot Integration] Уведомление сохранено в Supabase, парсер его обработает');
      }

    } catch (error) {
      console.error('❌ [Bot Integration] Ошибка отправки уведомления:', error);
    }
  }

  /**
   * Форматирование сообщения для уведомления
   */
  formatNotificationMessage(vacancy) {
    const categoryEmoji = {
      'ТОЧНО ТВОЁ': '🎯',
      'МОЖЕТ БЫТЬ': '🤔', 
      'НЕ ТВОЁ': '❌'
    };

    const emoji = categoryEmoji[vacancy.category] || '📋';
    
    let message = `${emoji} Новая вакансия!\n\n`;
    
    if (vacancy.title || vacancy.reason) {
      message += `💼 ${vacancy.title || vacancy.reason}\n`;
    }
    
    if (vacancy.company_name || vacancy.company) {
      message += `🏢 ${vacancy.company_name || vacancy.company}\n`;
    }
    
    if (vacancy.category) {
      message += `📂 ${vacancy.category}\n`;
    }
    
    return message;
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

    // ✅ BUG FIX: Отслеживаем timeouts для возможности очистки
    // Автоскрытие
    const hideTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-20px)';

      const removeTimer = setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
        this.pendingTimeouts.delete(removeTimer);
      }, 300);

      this.pendingTimeouts.add(removeTimer);
    }, duration);

    this.pendingTimeouts.add(hideTimer);
  }

  /**
   * Очистка всех handlers и timeouts
   */
  destroy() {
    // ✅ BUG FIX: Удаляем все event listeners
    for (const [eventName, handler] of this.eventHandlers) {
      document.removeEventListener(eventName, handler);
    }
    this.eventHandlers.clear();

    // ✅ BUG FIX: Очищаем все pending timeouts
    for (const timeout of this.pendingTimeouts) {
      clearTimeout(timeout);
    }
    this.pendingTimeouts.clear();

    console.log('[Simple Bot] Очищены все handlers и timeouts');
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
      userId: this.getTelegramUserId(), // ✅ FIX: Use dynamic user ID
      chatId: this.getTelegramUserId(), // ✅ FIX: Use dynamic user ID
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