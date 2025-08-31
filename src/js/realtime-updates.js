/**
 * Realtime Updates Manager - Phase 3.2
 * Управление live обновлениями вакансий через WebSocket
 */

class RealtimeUpdates {
  constructor() {
    this.isEnabled = true;
    this.animationQueue = [];
    this.processingAnimation = false;
    this.notificationCount = 0;
    
    // Настройки анимаций
    this.animationDuration = 500;
    this.staggerDelay = 100;
    
    // Кэш для предотвращения дубликатов
    this.processedEvents = new Map();
    this.eventTTL = 30000; // 30 секунд
    
    this.init();
  }

  /**
   * Инициализация real-time обновлений
   */
  init() {
    // Подписываемся на WebSocket события
    this.setupWebSocketListeners();
    
    // Очистка старых событий каждые 30 секунд
    setInterval(() => this.cleanupProcessedEvents(), 30000);
    
    console.log('[Realtime Updates] Инициализирован');
  }

  /**
   * Настройка слушателей WebSocket событий
   */
  setupWebSocketListeners() {
    // Новая вакансия
    document.addEventListener('vacancy:new', (event) => {
      if (this.isEnabled && !this.isDuplicate('new', event.detail)) {
        this.handleNewVacancy(event.detail);
      }
    });

    // Обновление вакансии
    document.addEventListener('vacancy:updated', (event) => {
      if (this.isEnabled && !this.isDuplicate('updated', event.detail)) {
        this.handleUpdatedVacancy(event.detail);
      }
    });

    // Удаление вакансии
    document.addEventListener('vacancy:deleted', (event) => {
      if (this.isEnabled && !this.isDuplicate('deleted', event.detail)) {
        this.handleDeletedVacancy(event.detail);
      }
    });

    // Статус подключения
    document.addEventListener('ws:connected', () => {
      this.showConnectionNotification('connected');
    });

    document.addEventListener('ws:disconnected', () => {
      this.showConnectionNotification('disconnected');
    });
  }

  /**
   * Обработка новой вакансии
   */
  async handleNewVacancy(vacancyData) {
    console.log('[Realtime Updates] Новая вакансия:', vacancyData);
    
    try {
      // Определяем в какую категорию добавить вакансию
      const targetCategory = this.mapCategoryToList(vacancyData.category);
      const listContainer = document.getElementById(targetCategory);
      
      if (!listContainer) {
        console.warn('[Realtime Updates] Контейнер категории не найден:', targetCategory);
        return;
      }

      // Создаем карточку вакансии с полным функционалом
      const vacancyCard = await this.createVacancyCard(vacancyData);
      if (!vacancyCard) {
        console.error('[Realtime Updates] Не удалось создать карточку вакансии');
        return;
      }

      console.log('[Realtime Updates] ✅ Карточка создана, проверяем функционал...');
      
      // Проверяем что карточка создана правильно
      const applyBtn = vacancyCard.querySelector('[data-element="apply-btn"]');
      const hasApplyUrl = vacancyData.apply_url && vacancyData.apply_url.trim() !== '';
      
      console.log('[Realtime Updates] Apply URL:', vacancyData.apply_url, 'Кнопка найдена:', !!applyBtn);
      
      // Помечаем как новую для анимации
      vacancyCard.classList.add('vacancy-new', 'vacancy-realtime');
      
      // Добавляем в начало списка с анимацией
      this.addVacancyWithAnimation(listContainer, vacancyCard, 'new');
      
      // Обновляем счетчик категории
      this.updateCategoryCount(vacancyData.category, 1);
      
      // Показываем уведомление
      this.showVacancyNotification('new', vacancyData);
      
      // Haptic feedback для Telegram
      this.triggerHapticFeedback('light');
      
    } catch (error) {
      console.error('[Realtime Updates] Ошибка при обработке новой вакансии:', error);
    }
  }

  /**
   * Обработка обновления вакансии
   */
  async handleUpdatedVacancy(vacancyData) {
    console.log('[Realtime Updates] Обновление вакансии:', vacancyData);
    
    try {
      // Находим существующую карточку
      const existingCard = this.findVacancyCard(vacancyData.id);
      
      if (existingCard) {
        // Обновляем существующую карточку
        await this.updateVacancyCard(existingCard, vacancyData);
        
        // Добавляем анимацию обновления
        this.animateVacancyUpdate(existingCard);
        
      } else {
        // Карточка не найдена - добавляем как новую
        console.warn('[Realtime Updates] Карточка для обновления не найдена, добавляем как новую');
        this.handleNewVacancy(vacancyData);
        return;
      }
      
      // Показываем уведомление об обновлении
      this.showVacancyNotification('updated', vacancyData);
      
      // Легкий haptic feedback
      this.triggerHapticFeedback('soft');
      
    } catch (error) {
      console.error('[Realtime Updates] Ошибка при обновлении вакансии:', error);
    }
  }

  /**
   * Обработка удаления вакансии
   */
  handleDeletedVacancy(eventData) {
    console.log('[Realtime Updates] Удаление вакансии:', eventData);
    
    try {
      const vacancyCard = this.findVacancyCard(eventData.id);
      
      if (vacancyCard) {
        // Получаем категорию перед удалением для обновления счетчика
        const category = this.getVacancyCategoryFromCard(vacancyCard);
        
        // Удаляем с анимацией
        this.removeVacancyWithAnimation(vacancyCard);
        
        // Обновляем счетчик категории
        if (category) {
          this.updateCategoryCount(category, -1);
        }
        
        // Показываем уведомление
        this.showVacancyNotification('deleted', { 
          id: eventData.id, 
          reason: eventData.reason 
        });
        
      } else {
        console.warn('[Realtime Updates] Карточка для удаления не найдена:', eventData.id);
      }
      
    } catch (error) {
      console.error('[Realtime Updates] Ошибка при удалении вакансии:', error);
    }
  }

  /**
   * Создание карточки вакансии
   */
  async createVacancyCard(vacancyData) {
    console.log('[Realtime Updates] Создаем карточку для вакансии:', vacancyData);
    
    // Всегда используем основную функцию createVacancyCard если она доступна
    if (window.createVacancyCard && typeof window.createVacancyCard === 'function') {
      console.log('[Realtime Updates] Используем window.createVacancyCard с полным функционалом');
      // Используем с правильными опциями для main страницы
      return window.createVacancyCard(vacancyData, {
        pageType: 'main',
        searchQuery: ''
      });
    }
    
    console.log('[Realtime Updates] ⚠️ FALLBACK: window.createVacancyCard недоступен');
    
    // Fallback - создаем базовую карточку
    const template = document.getElementById('vacancy-card-template');
    if (!template) {
      console.error('[Realtime Updates] Шаблон карточки не найден');
      return null;
    }
    
    const cardClone = template.content.cloneNode(true);
    const card = cardClone.querySelector('.vacancy-card');
    
    // Добавляем правильные CSS классы для категории
    if (vacancyData.category === 'ТОЧНО ТВОЁ') {
      card.classList.add('category-main');
    } else if (vacancyData.category === 'МОЖЕТ БЫТЬ') {
      card.classList.add('category-maybe');
    } else {
      card.classList.add('category-other');
    }
    
    // Добавляем NEW бейдж для новых вакансий
    const isNew = this.isVacancyNew(vacancyData.created_at || vacancyData.timestamp);
    if (isNew) {
      const newBadge = document.createElement('div');
      newBadge.className = 'new-badge';
      newBadge.textContent = 'NEW';
      card.appendChild(newBadge);
    }
    
    // Заполняем основные данные
    const categoryEl = card.querySelector('[data-element="category"]');
    const summaryEl = card.querySelector('[data-element="summary"]');
    const channelEl = card.querySelector('[data-element="channel"]');
    const timestampEl = card.querySelector('[data-element="timestamp"]');
    const fullTextEl = card.querySelector('[data-element="full-text"]');
    const detailsEl = card.querySelector('[data-element="details"]');
    
    if (categoryEl) categoryEl.textContent = vacancyData.category || 'Без категории';
    if (summaryEl) summaryEl.textContent = vacancyData.reason || vacancyData.title || vacancyData.description || 'Описание отсутствует';
    if (channelEl) channelEl.textContent = vacancyData.channel || vacancyData.company_name || 'Неизвестный канал';
    if (timestampEl) timestampEl.textContent = this.formatTimestamp(vacancyData.created_at || vacancyData.timestamp);
    
    // Добавляем полный текст если есть
    if (fullTextEl && (vacancyData.text_highlighted || vacancyData.text)) {
      fullTextEl.innerHTML = vacancyData.text_highlighted || vacancyData.text;
    } else if (detailsEl && !vacancyData.text_highlighted && !vacancyData.text) {
      // Скрываем details если нет полного текста
      detailsEl.style.display = 'none';
    }
    
    // Добавляем ID для поиска
    card.dataset.vacancyId = vacancyData.id;
    
    // Убираем лишние swipe индикаторы которые могут создаваться
    const existingLeftIcon = card.querySelector('.swipe-icon.left');
    const existingRightIcon = card.querySelector('.swipe-icon.right');
    if (existingLeftIcon) existingLeftIcon.remove();
    if (existingRightIcon) existingRightIcon.remove();
    
    // Создаем правильные swipe индикаторы
    const leftIcon = document.createElement('div');
    leftIcon.className = 'swipe-icon left';
    leftIcon.textContent = '✕';
    card.appendChild(leftIcon);

    const rightIcon = document.createElement('div');
    rightIcon.className = 'swipe-icon right';
    rightIcon.textContent = '★';
    card.appendChild(rightIcon);
    
    return card;
  }

  /**
   * Проверка является ли вакансия новой (создана в последние 3 часа)
   */
  isVacancyNew(dateString) {
    if (!dateString) return false;
    
    try {
      const vacancyDate = new Date(dateString);
      const now = new Date();
      const diffMs = now - vacancyDate;
      const diffHours = diffMs / (1000 * 60 * 60);
      return diffHours <= 3;
    } catch (error) {
      console.warn('[Realtime Updates] Ошибка проверки даты вакансии:', error);
      return false;
    }
  }

  /**
   * Обновление существующей карточки вакансии
   */
  async updateVacancyCard(card, vacancyData) {
    // Обновляем содержимое карточки
    const summaryEl = card.querySelector('[data-element="summary"]');
    const timestampEl = card.querySelector('[data-element="timestamp"]');
    
    if (summaryEl && vacancyData.title) {
      summaryEl.textContent = vacancyData.title;
    }
    
    if (timestampEl) {
      timestampEl.textContent = this.formatTimestamp(vacancyData.timestamp);
    }
    
    // Добавляем индикатор обновления
    card.classList.add('vacancy-updated');
    
    // Удаляем индикатор через 5 секунд
    setTimeout(() => {
      card.classList.remove('vacancy-updated');
    }, 5000);
  }

  /**
   * Добавление вакансии с анимацией
   */
  addVacancyWithAnimation(container, card, type = 'new') {
    // Подготавливаем карточку к анимации
    card.style.opacity = '0';
    card.style.transform = 'translateY(-20px) scale(0.95)';
    card.style.transition = `all ${this.animationDuration}ms cubic-bezier(0.4, 0.0, 0.2, 1)`;
    
    // Вставляем в начало списка
    if (container.firstChild) {
      container.insertBefore(card, container.firstChild);
    } else {
      container.appendChild(card);
    }
    
    // Запускаем анимацию появления
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        card.style.opacity = '1';
        card.style.transform = 'translateY(0) scale(1)';
        
        // Пульсация для новых вакансий
        if (type === 'new') {
          setTimeout(() => {
            this.pulseAnimation(card);
          }, this.animationDuration);
        }
      });
    });
  }

  /**
   * Удаление вакансии с анимацией
   */
  removeVacancyWithAnimation(card) {
    card.style.transition = `all ${this.animationDuration}ms ease-in`;
    card.style.opacity = '0';
    card.style.transform = 'translateX(100%) scale(0.8)';
    
    setTimeout(() => {
      if (card.parentNode) {
        card.parentNode.removeChild(card);
      }
    }, this.animationDuration);
  }

  /**
   * Анимация обновления вакансии
   */
  animateVacancyUpdate(card) {
    // Кратковременная подсветка
    card.style.boxShadow = '0 0 20px rgba(76, 175, 80, 0.5)';
    card.style.transform = 'scale(1.02)';
    card.style.transition = 'all 200ms ease';
    
    setTimeout(() => {
      card.style.boxShadow = '';
      card.style.transform = 'scale(1)';
    }, 200);
  }

  /**
   * Анимация пульсации для новых вакансий
   */
  pulseAnimation(card) {
    card.style.animation = 'vacancy-pulse 0.6s ease-in-out';
    
    setTimeout(() => {
      card.style.animation = '';
    }, 600);
  }

  /**
   * Поиск карточки вакансии по ID
   */
  findVacancyCard(vacancyId) {
    return document.querySelector(`[data-vacancy-id="${vacancyId}"]`);
  }

  /**
   * Определение категории карточки
   */
  getVacancyCategoryFromCard(card) {
    const categoryEl = card.querySelector('[data-element="category"]');
    return categoryEl ? categoryEl.textContent : null;
  }

  /**
   * Маппинг категории на ID списка
   */
  mapCategoryToList(category) {
    const categoryMap = {
      'ТОЧНО ТВОЁ': 'vacancies-list-main',
      'МОЖЕТ БЫТЬ': 'vacancies-list-maybe',
      'НЕ ТВОЁ': 'vacancies-list-other'
    };
    return categoryMap[category] || 'vacancies-list-main';
  }

  /**
   * Обновление счетчика категории
   */
  updateCategoryCount(category, delta) {
    const countMap = {
      'ТОЧНО ТВОЁ': 'count-main',
      'МОЖЕТ БЫТЬ': 'count-maybe', 
      'НЕ ТВОЁ': 'count-other'
    };
    
    const counterId = countMap[category];
    if (!counterId) return;
    
    const counterEl = document.getElementById(counterId);
    if (counterEl) {
      const currentCount = parseInt(counterEl.textContent) || 0;
      const newCount = Math.max(0, currentCount + delta);
      counterEl.textContent = newCount;
      
      // Анимация изменения счетчика
      counterEl.style.transform = 'scale(1.2)';
      counterEl.style.transition = 'transform 200ms ease';
      
      setTimeout(() => {
        counterEl.style.transform = 'scale(1)';
      }, 200);
    }
  }

  /**
   * Показ уведомления о вакансии
   */
  showVacancyNotification(type, data) {
    if (!this.isEnabled) return;
    
    let message = '';
    let icon = '';
    
    switch (type) {
      case 'new':
        message = `Новая вакансия: ${data.title || 'Без названия'}`;
        icon = '🆕';
        break;
      case 'updated':
        message = `Обновлена: ${data.title || 'Вакансия'}`;
        icon = '🔄';
        break;
      case 'deleted':
        message = `Вакансия удалена`;
        icon = '🗑️';
        break;
    }
    
    this.showToast(`${icon} ${message}`, 'info', 3000);
  }

  /**
   * Показ уведомления о подключении
   */
  showConnectionNotification(status) {
    const messages = {
      connected: { text: '🟢 Real-time обновления активны', type: 'success' },
      disconnected: { text: '🔴 Подключение потеряно', type: 'warning' }
    };
    
    const notification = messages[status];
    if (notification) {
      this.showToast(notification.text, notification.type, 2000);
    }
  }

  /**
   * Показ toast уведомления
   */
  showToast(message, type = 'info', duration = 3000) {
    // Используем существующую систему toast если она есть
    if (window.showToast && typeof window.showToast === 'function') {
      window.showToast(message, type);
      return;
    }
    
    // Fallback toast система
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : type === 'warning' ? '#FF9800' : '#2196F3'};
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 10000;
      opacity: 0;
      transform: translateX(100%);
      transition: all 300ms ease;
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
    }, duration);
  }

  /**
   * Haptic feedback для Telegram
   */
  triggerHapticFeedback(type = 'light') {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      try {
        switch (type) {
          case 'light':
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
            break;
          case 'soft':
            window.Telegram.WebApp.HapticFeedback.impactOccurred('soft');
            break;
          case 'medium':
            window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            break;
        }
      } catch (error) {
        console.warn('[Realtime Updates] Haptic feedback недоступен:', error);
      }
    }
  }

  /**
   * Проверка на дубликат события
   */
  isDuplicate(eventType, data) {
    const key = `${eventType}_${data.id}_${data.timestamp}`;
    
    if (this.processedEvents.has(key)) {
      return true;
    }
    
    this.processedEvents.set(key, {
      timestamp: Date.now(),
      data: data
    });
    
    return false;
  }

  /**
   * Очистка старых обработанных событий
   */
  cleanupProcessedEvents() {
    const now = Date.now();
    const keysToDelete = [];
    
    this.processedEvents.forEach((value, key) => {
      if (now - value.timestamp > this.eventTTL) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      this.processedEvents.delete(key);
    });
    
    if (keysToDelete.length > 0) {
      console.log(`[Realtime Updates] Очищено ${keysToDelete.length} старых событий`);
    }
  }

  /**
   * Форматирование timestamp
   */
  formatTimestamp(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) { // меньше минуты
      return 'только что';
    } else if (diff < 3600000) { // меньше часа
      const minutes = Math.floor(diff / 60000);
      return `${minutes} мин назад`;
    } else if (diff < 86400000) { // меньше дня
      const hours = Math.floor(diff / 3600000);
      return `${hours} ч назад`;
    } else {
      return date.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  /**
   * Включение/отключение real-time обновлений
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    console.log(`[Realtime Updates] ${enabled ? 'Включены' : 'Отключены'}`);
  }

  /**
   * Получение статистики
   */
  getStats() {
    return {
      enabled: this.isEnabled,
      processedEvents: this.processedEvents.size,
      notificationCount: this.notificationCount,
      animationQueueLength: this.animationQueue.length
    };
  }
}

// CSS стили для анимаций
const styles = `
.vacancy-new {
  position: relative;
}

.vacancy-new::before {
  content: '🆕';
  position: absolute;
  top: -5px;
  right: -5px;
  font-size: 16px;
  z-index: 10;
  animation: bounce 0.8s ease-in-out;
}

.vacancy-updated {
  border-left: 3px solid #4CAF50;
  transition: border-left 300ms ease;
}

.vacancy-realtime {
  animation: vacancy-entrance 0.5s cubic-bezier(0.4, 0.0, 0.2, 1);
}

@keyframes vacancy-entrance {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes vacancy-pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}
`;

// Добавляем стили в DOM
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// Глобальный экспорт
window.RealtimeUpdates = RealtimeUpdates;

// Создаем глобальный экземпляр
window.realtimeUpdates = new RealtimeUpdates();

console.log('[Phase 3.2] Realtime Updates Manager инициализирован');