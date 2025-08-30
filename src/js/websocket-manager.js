/**
 * WebSocket Manager - Phase 3.2 Real-time Features
 * Socket.IO интеграция для live обновлений вакансий
 */

class WebSocketManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 2000;
    this.currentRooms = new Set();
    this.messageQueue = [];
    this.listeners = new Map();
    
    // События для интеграции с приложением
    this.events = {
      connected: 'ws:connected',
      disconnected: 'ws:disconnected', 
      vacancyNew: 'vacancy:new',
      vacancyUpdated: 'vacancy:updated',
      vacancyDeleted: 'vacancy:deleted',
      searchResults: 'search:results'
    };
    
    this.init();
  }

  /**
   * Инициализация WebSocket соединения
   */
  async init() {
    try {
      await this.loadSocketIO();
      this.connect();
    } catch (error) {
      console.warn('[WebSocket] Socket.IO недоступен, работаем без real-time функций:', error);
      this.dispatchEvent('ws:fallback', { reason: 'socket.io_unavailable' });
    }
  }

  /**
   * Загрузка Socket.IO библиотеки с fallback CDN
   */
  async loadSocketIO() {
    if (window.io) {
      return Promise.resolve();
    }

    const cdnUrls = [
      'https://cdn.socket.io/4.7.0/socket.io.min.js',
      'https://unpkg.com/socket.io@4.7.0/dist/socket.io.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.0/socket.io.min.js'
    ];

    for (const url of cdnUrls) {
      try {
        await this.loadScript(url);
        if (window.io) {
          console.log(`[WebSocket] Socket.IO загружен с: ${url}`);
          return;
        }
      } catch (error) {
        console.warn(`[WebSocket] Не удалось загрузить Socket.IO с ${url}:`, error);
      }
    }
    
    throw new Error('Все CDN Socket.IO недоступны');
  }

  /**
   * Загрузка скрипта с Promise
   */
  loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Установка WebSocket соединения
   */
  connect() {
    if (!window.io) {
      throw new Error('Socket.IO не загружен');
    }

    // Определяем WebSocket сервер (для разработки используем mock)
    const wsUrl = this.getWebSocketUrl();
    
    // Если URL не определен (production без WebSocket сервера), переходим в fallback
    if (!wsUrl) {
      console.warn('[WebSocket] WebSocket сервер недоступен, переходим в fallback режим');
      this.dispatchEvent('ws:fallback', { reason: 'no_server_configured' });
      return;
    }
    
    console.log(`[WebSocket] Подключение к: ${wsUrl}`);
    
    this.socket = window.io(wsUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectInterval,
      forceNew: false
    });

    this.setupEventHandlers();
  }

  /**
   * Определение URL WebSocket сервера
   */
  getWebSocketUrl() {
    // Для разработки используем mock server или локальный
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3001'; // Mock server для разработки
    }
    
    // Для production - пока WebSocket сервер не развернут, возвращаем null для fallback
    // TODO: После развертывания WebSocket сервера заменить на реальный URL
    return null; // Временно отключаем WebSocket в production
  }

  /**
   * Настройка обработчиков WebSocket событий
   */
  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('[WebSocket] ✅ Соединение установлено');
      this.connected = true;
      this.reconnectAttempts = 0;
      
      // Восстанавливаем подписки на room'ы
      this.rejoinRooms();
      
      // Отправляем накопленные сообщения
      this.processMessageQueue();
      
      this.dispatchEvent(this.events.connected);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('[WebSocket] ❌ Соединение потеряно:', reason);
      this.connected = false;
      this.dispatchEvent(this.events.disconnected, { reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Ошибка подключения:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.warn('[WebSocket] Максимум попыток переподключения достигнут');
        this.dispatchEvent('ws:max_reconnects_reached');
      }
    });

    // Обработка событий вакансий
    this.socket.on('vacancy:new', (data) => {
      console.log('[WebSocket] Новая вакансия:', data);
      this.dispatchEvent(this.events.vacancyNew, data);
    });

    this.socket.on('vacancy:updated', (data) => {
      console.log('[WebSocket] Обновление вакансии:', data);
      this.dispatchEvent(this.events.vacancyUpdated, data);
    });

    this.socket.on('vacancy:deleted', (data) => {
      console.log('[WebSocket] Удаление вакансии:', data);
      this.dispatchEvent(this.events.vacancyDeleted, data);
    });

    // Обработка результатов поиска
    this.socket.on('search:results', (data) => {
      console.log('[WebSocket] Результаты поиска:', data);
      this.dispatchEvent(this.events.searchResults, data);
    });
  }

  /**
   * Подписка на room для получения обновлений категории
   */
  subscribeToCategory(category) {
    const roomName = this.getCategoryRoom(category);
    
    if (this.currentRooms.has(roomName)) {
      return; // Уже подписаны
    }

    if (this.connected && this.socket) {
      this.socket.emit('join_room', roomName);
      this.currentRooms.add(roomName);
      console.log(`[WebSocket] Подписка на room: ${roomName}`);
    } else {
      // Добавляем в очередь для выполнения после подключения
      this.queueMessage('join_room', roomName);
    }
  }

  /**
   * Отписка от room категории
   */
  unsubscribeFromCategory(category) {
    const roomName = this.getCategoryRoom(category);
    
    if (!this.currentRooms.has(roomName)) {
      return; // Не подписаны
    }

    if (this.connected && this.socket) {
      this.socket.emit('leave_room', roomName);
      this.currentRooms.delete(roomName);
      console.log(`[WebSocket] Отписка от room: ${roomName}`);
    }
  }

  /**
   * Переключение подписки на другую категорию
   */
  switchCategory(newCategory) {
    // Отписываемся от всех текущих room'ов
    this.currentRooms.forEach(room => {
      if (this.connected && this.socket) {
        this.socket.emit('leave_room', room);
      }
    });
    this.currentRooms.clear();
    
    // Подписываемся на новую категорию
    this.subscribeToCategory(newCategory);
  }

  /**
   * Real-time поиск
   */
  search(query, options = {}) {
    const searchData = {
      query: query.trim(),
      categories: options.categories || ['all'],
      limit: options.limit || 50,
      timestamp: Date.now()
    };

    if (this.connected && this.socket) {
      this.socket.emit('search:query', searchData);
    } else {
      console.warn('[WebSocket] Поиск недоступен - нет соединения');
      // Fallback к локальному поиску через существующую логику
      this.dispatchEvent('search:fallback', searchData);
    }
  }

  /**
   * Получение имени room для категории
   */
  getCategoryRoom(category) {
    const categoryMap = {
      'ТОЧНО ТВОЁ': 'main-vacancies',
      'МОЖЕТ БЫТЬ': 'maybe-vacancies', 
      'НЕ ТВОЁ': 'other-vacancies'
    };
    return categoryMap[category] || 'all-vacancies';
  }

  /**
   * Восстановление подписок после переподключения
   */
  rejoinRooms() {
    this.currentRooms.forEach(room => {
      if (this.socket) {
        this.socket.emit('join_room', room);
      }
    });
  }

  /**
   * Добавление сообщения в очередь
   */
  queueMessage(event, data) {
    this.messageQueue.push({ event, data, timestamp: Date.now() });
  }

  /**
   * Обработка накопленных сообщений
   */
  processMessageQueue() {
    const maxAge = 30000; // 30 секунд
    const now = Date.now();
    
    this.messageQueue = this.messageQueue.filter(msg => {
      if (now - msg.timestamp > maxAge) {
        console.warn('[WebSocket] Сообщение устарело, пропускаем:', msg);
        return false;
      }
      
      if (this.socket) {
        this.socket.emit(msg.event, msg.data);
      }
      return false;
    });
  }

  /**
   * Отправка custom события
   */
  dispatchEvent(eventName, data = null) {
    const customEvent = new CustomEvent(eventName, { 
      detail: data,
      bubbles: true
    });
    document.dispatchEvent(customEvent);
  }

  /**
   * Добавление обработчика событий
   */
  addEventListener(eventName, handler) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(handler);
    
    // Также добавляем на document для глобальных событий
    document.addEventListener(eventName, handler);
  }

  /**
   * Удаление обработчика событий
   */
  removeEventListener(eventName, handler) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).delete(handler);
    }
    document.removeEventListener(eventName, handler);
  }

  /**
   * Получение статуса соединения
   */
  getConnectionStatus() {
    return {
      connected: this.connected,
      reconnectAttempts: this.reconnectAttempts,
      activeRooms: Array.from(this.currentRooms),
      queuedMessages: this.messageQueue.length
    };
  }

  /**
   * Принудительное переподключение
   */
  reconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket.connect();
    }
  }

  /**
   * Очистка ресурсов
   */
  destroy() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.listeners.forEach((handlers, eventName) => {
      handlers.forEach(handler => {
        document.removeEventListener(eventName, handler);
      });
    });
    
    this.listeners.clear();
    this.currentRooms.clear();
    this.messageQueue = [];
    this.connected = false;
  }
}

// Глобальный экспорт
window.WebSocketManager = WebSocketManager;

// Создаем глобальный экземпляр для использования в приложении
window.wsManager = new WebSocketManager();

console.log('[Phase 3.2] WebSocket Manager инициализирован');