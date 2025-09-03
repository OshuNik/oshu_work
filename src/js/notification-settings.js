/**
 * Notification Settings Manager - Phase 3.2
 * Управление настройками уведомлений в settings.html
 */

class NotificationSettings {
  constructor() {
    this.isInitialized = false;
    this.elements = {};
    
    // Настройки по умолчанию
    this.defaultSettings = {
      enabled: false,
      newVacancies: true,
      favoriteUpdates: true,
      categoryFilter: 'all',
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      }
    };
    
    this.init();
  }

  /**
   * Инициализация настроек уведомлений
   */
  async init() {
    // Проверяем что мы на странице настроек
    if (!document.getElementById('notifications-section')) {
      return;
    }

    await this.findElements();
    await this.loadCurrentSettings();
    this.setupEventHandlers();
    this.updateStatusDisplay();
    
    this.isInitialized = true;
    console.log('[Notification Settings] Инициализированы');
  }

  /**
   * Поиск элементов интерфейса
   */
  async findElements() {
    this.elements = {
      // Основные переключатели
      enabled: document.getElementById('notifications-enabled'),
      newVacancies: document.getElementById('notify-new-vacancies'),
      favorites: document.getElementById('notify-favorites'),
      
      // Фильтры категорий
      filterAll: document.getElementById('filter-all'),
      filterMain: document.getElementById('filter-main'),
      filterMaybe: document.getElementById('filter-maybe'),
      filterOther: document.getElementById('filter-other'),
      
      // Тихие часы
      quietEnabled: document.getElementById('quiet-hours-enabled'),
      quietStart: document.getElementById('quiet-start'),
      quietEnd: document.getElementById('quiet-end'),
      timeRangeControls: document.getElementById('time-range-controls'),
      
      // Кнопки управления
      testButton: document.getElementById('test-notification-btn'),
      refreshStatusButton: document.getElementById('refresh-status-btn'),
      
      // Элементы статуса
      notificationStatus: document.getElementById('notification-status'),
      botStatus: document.getElementById('bot-status'),
      userStatus: document.getElementById('user-status')
    };

    // Проверяем что все элементы найдены
    const missingElements = Object.entries(this.elements)
      .filter(([key, element]) => !element)
      .map(([key]) => key);
      
    if (missingElements.length > 0) {
      console.warn('[Notification Settings] Не найдены элементы:', missingElements);
    }
  }

  /**
   * Загрузка текущих настроек
   */
  async loadCurrentSettings() {
    let settings = { ...this.defaultSettings };
    
    try {
      // Загружаем из botIntegration если доступен
      if (window.botIntegration) {
        const botSettings = window.botIntegration.getSettings();
        settings = { ...settings, ...botSettings };
      }
      
      // Дополнительно проверяем localStorage
      const saved = localStorage.getItem('telegramNotificationSettings');
      if (saved) {
        const parsedSettings = JSON.parse(saved);
        settings = { ...settings, ...parsedSettings };
      }
      
    } catch (error) {
      console.warn('[Notification Settings] Ошибка загрузки настроек:', error);
    }
    
    // Применяем настройки к интерфейсу
    this.applySettingsToUI(settings);
  }

  /**
   * Применение настроек к интерфейсу
   */
  applySettingsToUI(settings) {
    // Основные переключатели
    if (this.elements.enabled) {
      this.elements.enabled.checked = settings.enabled;
    }
    
    if (this.elements.newVacancies) {
      this.elements.newVacancies.checked = settings.newVacancies;
    }
    
    if (this.elements.favorites) {
      this.elements.favorites.checked = settings.favoriteUpdates;
    }
    
    // Фильтр категорий
    const filterElement = this.elements[`filter${settings.categoryFilter.charAt(0).toUpperCase() + settings.categoryFilter.slice(1)}`];
    if (filterElement) {
      filterElement.checked = true;
    }
    
    // Тихие часы
    if (this.elements.quietEnabled) {
      this.elements.quietEnabled.checked = settings.quietHours.enabled;
    }
    
    if (this.elements.quietStart) {
      this.elements.quietStart.value = settings.quietHours.start;
    }
    
    if (this.elements.quietEnd) {
      this.elements.quietEnd.value = settings.quietHours.end;
    }
    
    // Показ/скрытие элементов управления временем
    this.toggleTimeRangeControls(settings.quietHours.enabled);
    
    // Обновляем статус в заголовке секции
    this.updateNotificationStatusIndicator(settings.enabled);
  }

  /**
   * Настройка обработчиков событий
   */
  setupEventHandlers() {
    // Главный переключатель уведомлений
    if (this.elements.enabled) {
      this.elements.enabled.addEventListener('change', async (e) => {
        const enabled = e.target.checked;
        await this.updateSetting('enabled', enabled);
        this.updateNotificationStatusIndicator(enabled);
      });
    }

    // Переключатель новых вакансий
    if (this.elements.newVacancies) {
      this.elements.newVacancies.addEventListener('change', async (e) => {
        await this.updateSetting('newVacancies', e.target.checked);
      });
    }

    // Переключатель избранного
    if (this.elements.favorites) {
      this.elements.favorites.addEventListener('change', async (e) => {
        await this.updateSetting('favoriteUpdates', e.target.checked);
      });
    }

    // Фильтры категорий
    const categoryFilters = [
      { element: this.elements.filterAll, value: 'all' },
      { element: this.elements.filterMain, value: 'main' },
      { element: this.elements.filterMaybe, value: 'maybe' },
      { element: this.elements.filterOther, value: 'other' }
    ];

    categoryFilters.forEach(({ element, value }) => {
      if (element) {
        element.addEventListener('change', async (e) => {
          if (e.target.checked) {
            await this.updateSetting('categoryFilter', value);
          }
        });
      }
    });

    // Тихие часы
    if (this.elements.quietEnabled) {
      this.elements.quietEnabled.addEventListener('change', async (e) => {
        const enabled = e.target.checked;
        this.toggleTimeRangeControls(enabled);
        
        await this.updateQuietHours({
          enabled,
          start: this.elements.quietStart?.value || '22:00',
          end: this.elements.quietEnd?.value || '08:00'
        });
      });
    }

    // Изменение времени тихих часов
    [this.elements.quietStart, this.elements.quietEnd].forEach(element => {
      if (element) {
        element.addEventListener('change', async () => {
          if (this.elements.quietEnabled?.checked) {
            await this.updateQuietHours({
              enabled: true,
              start: this.elements.quietStart.value,
              end: this.elements.quietEnd.value
            });
          }
        });
      }
    });

    // Кнопка теста уведомления
    if (this.elements.testButton) {
      this.elements.testButton.addEventListener('click', async () => {
        await this.testNotification();
      });
    }

    // Кнопка обновления статуса
    if (this.elements.refreshStatusButton) {
      this.elements.refreshStatusButton.addEventListener('click', () => {
        this.updateStatusDisplay();
      });
    }
  }

  /**
   * Обновление одной настройки
   */
  async updateSetting(key, value) {
    try {
      if (window.botIntegration) {
        await window.botIntegration.updateNotificationSettings({ [key]: value });
        console.log(`[Notification Settings] Обновлено ${key}:`, value);
      } else {
        console.warn('[Notification Settings] Bot Integration недоступен');
      }
      
    } catch (error) {
      console.error('[Notification Settings] Ошибка обновления настройки:', error);
      this.showError('Не удалось сохранить настройки');
    }
  }

  /**
   * Обновление настроек тихих часов
   */
  async updateQuietHours(quietHours) {
    try {
      if (window.botIntegration) {
        await window.botIntegration.updateNotificationSettings({ quietHours });
        console.log('[Notification Settings] Тихие часы обновлены:', quietHours);
      }
      
    } catch (error) {
      console.error('[Notification Settings] Ошибка обновления тихих часов:', error);
      this.showError('Не удалось сохранить настройки тихих часов');
    }
  }

  /**
   * Показ/скрытие элементов управления временем
   */
  toggleTimeRangeControls(show) {
    if (this.elements.timeRangeControls) {
      this.elements.timeRangeControls.style.display = show ? 'flex' : 'none';
    }
  }

  /**
   * Обновление индикатора статуса уведомлений
   */
  updateNotificationStatusIndicator(enabled) {
    if (this.elements.notificationStatus) {
      this.elements.notificationStatus.textContent = enabled ? 'ON' : 'OFF';
      this.elements.notificationStatus.className = `favorites-count ${enabled ? 'status-on' : 'status-off'}`;
    }
  }

  /**
   * Обновление отображения статуса сервисов
   */
  updateStatusDisplay() {
    // Статус Telegram Bot
    if (this.elements.botStatus && window.botIntegration) {
      const botStatus = window.botIntegration.getStatus();
      const statusText = botStatus.enabled ? '✅ Подключен' : '❌ Не подключен';
      this.elements.botStatus.textContent = statusText;
      this.elements.botStatus.className = `status-value ${botStatus.enabled ? 'status-success' : 'status-error'}`;
    } else if (this.elements.botStatus) {
      this.elements.botStatus.textContent = '❓ Недоступен';
      this.elements.botStatus.className = 'status-value status-warning';
    }

    // WebSocket статус удален - функция больше не используется

    // Статус пользователя
    if (this.elements.userStatus && window.botIntegration) {
      const botStatus = window.botIntegration.getStatus();
      if (botStatus.userId) {
        this.elements.userStatus.textContent = `✅ ID: ${botStatus.userId}`;
        this.elements.userStatus.className = 'status-value status-success';
      } else {
        this.elements.userStatus.textContent = '❌ Не авторизован';
        this.elements.userStatus.className = 'status-value status-error';
      }
    } else if (this.elements.userStatus) {
      this.elements.userStatus.textContent = '❓ Недоступен';
      this.elements.userStatus.className = 'status-value status-warning';
    }
  }

  /**
   * Тестирование уведомления
   */
  async testNotification() {
    if (!this.elements.testButton) return;
    
    const originalText = this.elements.testButton.innerHTML;
    this.elements.testButton.innerHTML = '<i class="bi bi-hourglass"></i> Отправка...';
    this.elements.testButton.disabled = true;

    try {
      if (window.botIntegration) {
        const success = await window.botIntegration.testNotification();
        
        if (success) {
          this.showSuccess('Тест уведомления отправлен');
          this.elements.testButton.innerHTML = '<i class="bi bi-check"></i> Отправлено';
        } else {
          this.showError('Не удалось отправить тест уведомления');
          this.elements.testButton.innerHTML = '<i class="bi bi-x"></i> Ошибка';
        }
      } else {
        this.showError('Bot Integration недоступен');
        this.elements.testButton.innerHTML = '<i class="bi bi-x"></i> Недоступен';
      }
      
    } catch (error) {
      console.error('[Notification Settings] Ошибка теста уведомления:', error);
      this.showError('Произошла ошибка при отправке');
      this.elements.testButton.innerHTML = '<i class="bi bi-x"></i> Ошибка';
    }

    // Восстанавливаем кнопку через 3 секунды
    setTimeout(() => {
      if (this.elements.testButton) {
        this.elements.testButton.innerHTML = originalText;
        this.elements.testButton.disabled = false;
      }
    }, 3000);
  }

  /**
   * Показ сообщения об успехе
   */
  showSuccess(message) {
    this.showToast(message, 'success');
  }

  /**
   * Показ сообщения об ошибке
   */
  showError(message) {
    this.showToast(message, 'error');
  }

  /**
   * Показ toast уведомления
   */
  showToast(message, type = 'info') {
    // Используем существующую систему toast если есть
    if (window.showToast && typeof window.showToast === 'function') {
      window.showToast(message, type);
      return;
    }

    // Fallback toast
    const toast = document.createElement('div');
    toast.className = `settings-toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 6px;
      color: white;
      font-size: 14px;
      z-index: 10000;
      opacity: 0;
      transform: translateX(100%);
      transition: all 300ms ease;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
    `;

    document.body.appendChild(toast);

    // Анимация появления
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });

    // Автоскрытие
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Получение текущих настроек из интерфейса
   */
  getCurrentUISettings() {
    return {
      enabled: this.elements.enabled?.checked || false,
      newVacancies: this.elements.newVacancies?.checked || false,
      favoriteUpdates: this.elements.favorites?.checked || false,
      categoryFilter: this.getSelectedCategoryFilter(),
      quietHours: {
        enabled: this.elements.quietEnabled?.checked || false,
        start: this.elements.quietStart?.value || '22:00',
        end: this.elements.quietEnd?.value || '08:00'
      }
    };
  }

  /**
   * Получение выбранного фильтра категорий
   */
  getSelectedCategoryFilter() {
    if (this.elements.filterAll?.checked) return 'all';
    if (this.elements.filterMain?.checked) return 'main';
    if (this.elements.filterMaybe?.checked) return 'maybe';
    if (this.elements.filterOther?.checked) return 'other';
    return 'all';
  }

  /**
   * Получение статистики
   */
  getStats() {
    return {
      initialized: this.isInitialized,
      currentSettings: this.getCurrentUISettings(),
      elementsFound: Object.keys(this.elements).length,
      botIntegrationAvailable: !!window.botIntegration,
      wsManagerAvailable: !!window.wsManager
    };
  }
}

// CSS стили для настроек уведомлений
const notificationSettingsStyles = `
/* Основные элементы управления */
.settings-controls {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin: 15px 0;
}

.control-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-color, #eee);
}

.control-row:last-child {
  border-bottom: none;
}

.control-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: var(--text-color, #333);
  cursor: pointer;
}

.control-label i {
  width: 16px;
  color: var(--accent-color, #007bff);
}

/* Toggle переключатели */
.toggle-switch {
  position: relative;
  width: 50px;
  height: 24px;
}

.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  border-radius: 24px;
  transition: 0.3s;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: 0.3s;
}

.toggle-input:checked + .toggle-slider {
  background-color: var(--accent-color, #007bff);
}

.toggle-input:checked + .toggle-slider:before {
  transform: translateX(26px);
}

/* Фильтры категорий */
.filter-options {
  margin: 15px 0;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 6px;
  transition: all 200ms ease;
  cursor: pointer;
}

.radio-option:hover {
  background-color: var(--hover-color, #f5f5f5);
  border-color: var(--accent-color, #007bff);
}

.radio-option input[type="radio"] {
  margin: 0;
  accent-color: var(--accent-color, #007bff);
}

.radio-option label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  cursor: pointer;
  flex: 1;
}

.radio-option label i {
  color: var(--accent-color, #007bff);
}

.radio-option input[type="radio"]:checked + label {
  color: var(--accent-color, #007bff);
}

/* Элементы управления временем */
.time-range-controls {
  display: flex;
  gap: 20px;
  margin-top: 15px;
  padding: 15px;
  background-color: var(--card-bg, #f8f9fa);
  border-radius: 6px;
}

.time-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-input-group label {
  font-weight: 500;
  color: var(--text-color, #333);
  min-width: 30px;
}

.time-input {
  padding: 6px 10px;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 4px;
  background-color: white;
  font-family: monospace;
}

/* Информация о статусе */
.status-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 15px 0;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.status-label {
  font-weight: 500;
  color: var(--text-color, #666);
}

.status-value {
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.status-success {
  background-color: #d4edda;
  color: #155724;
}

.status-error {
  background-color: #f8d7da;
  color: #721c24;
}

.status-warning {
  background-color: #fff3cd;
  color: #856404;
}

/* Статус в заголовке */
.status-on {
  color: #4CAF50 !important;
}

.status-off {
  color: #f44336 !important;
}

/* Адаптивность */
@media (max-width: 480px) {
  .time-range-controls {
    flex-direction: column;
    gap: 10px;
  }
  
  .radio-group {
    gap: 8px;
  }
  
  .radio-option {
    padding: 8px;
  }
}
`;

// Добавляем стили
const notificationStyleSheet = document.createElement('style');
notificationStyleSheet.textContent = notificationSettingsStyles;
document.head.appendChild(notificationStyleSheet);

// Глобальный экспорт
window.NotificationSettings = NotificationSettings;

// Создаем глобальный экземпляр
window.notificationSettings = new NotificationSettings();

console.log('[Phase 3.2] Notification Settings Manager инициализирован');