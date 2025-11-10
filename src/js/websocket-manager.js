/**
 * WebSocket Manager для получения новых вакансий из каналов
 * Подключается к backend WebSocket серверу для real-time обновлений
 * 
 * ✅ NOTE: In production, Supabase Realtime (realtime-manager.js) is used instead
 * This component is only for local development with mock WebSocket server
 */

class WebSocketManager {
  constructor() {
    // ✅ FIX: Only initialize in development (localhost)
    // In production (GitHub Pages, etc), skip initialization since Realtime Manager handles real-time updates
    const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1';
    
    if (!isLocalhost) {
      console.log('[WebSocket Manager] ⚠️ Skipped in production. Using Supabase Realtime instead.');
      this.disabled = true;
      return;
    }

    this.disabled = false;
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // 1 секунда
    this.heartbeatInterval = null;
    this.reconnectTimeout = null;
    this.eventListeners = new Map();

    // URL WebSocket сервера - only for localhost development
    this.wsUrl = 'ws://localhost:8081/ws';

    console.log('[WebSocket Manager] Инициализирован для development с URL:', this.wsUrl);
    this.connect();
  }

  /**
   * Подключение к WebSocket серверу
   */
  connect() {
    if (this.disabled) return;
    
    if (!this.wsUrl) {
      console.warn('[WebSocket Manager] WebSocket URL не определен, пропускаем подключение');
      return;
    }

    try {
      console.log('[WebSocket Manager] Подключение к', this.wsUrl);
      this.ws = new WebSocket(this.wsUrl);
      
      this.ws.onopen = this.onOpen.bind(this);
      this.ws.onmessage = this.onMessage.bind(this);
      this.ws.onclose = this.onClose.bind(this);
      this.ws.onerror = this.onError.bind(this);
      
    } catch (error) {
      console.error('[WebSocket Manager] Ошибка создания WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Обработка успешного подключения
   */
  onOpen() {
    if (this.disabled) return;

    console.log('✅ [WebSocket Manager] Подключение установлено');
    this.connected = true;
    this.reconnectAttempts = 0;
    
    this.startHeartbeat();
    
    document.dispatchEvent(new CustomEvent('websocket:connected', {
      detail: { url: this.wsUrl }
    }));
  }

  /**
   * Validate message structure and content
   */
  isValidMessageType(data) {
    const validTypes = ['welcome', 'vacancy:new', 'search:results', 'pong', 'error', 'status'];
    return validTypes.includes(data.type);
  }

  /**
   * Validate message content based on type
   */
  isValidMessageContent(data) {
    switch (data.type) {
      case 'vacancy:new':
        return data.data && typeof data.data === 'object' && data.data.id;

      case 'search:results':
        return (
          data.data &&
          typeof data.data === 'object' &&
          Array.isArray(data.data.results) &&
          typeof data.data.total === 'number'
        );

      case 'error':
        return data.data && typeof data.data === 'object' && data.data.message;

      case 'welcome':
      case 'pong':
      case 'status':
        return true;

      default:
        return false;
    }
  }

  /**
   * Обработка входящих сообщений с валидацией
   */
  onMessage(event) {
    if (this.disabled) return;

    try {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (e) {
        console.error('[WebSocket Manager] Invalid JSON received');
        return;
      }

      if (!message || typeof message !== 'object' || !message.type) {
        console.error('[WebSocket Manager] Message missing type field');
        return;
      }

      if (!this.isValidMessageType(message)) {
        console.warn('[WebSocket Manager] Unknown message type:', message.type);
        return;
      }

      if (!this.isValidMessageContent(message)) {
        console.warn('[WebSocket Manager] Invalid content for type:', message.type);
        return;
      }

      console.log('[WebSocket Manager] Valid message received:', message.type);

      switch (message.type) {
        case 'welcome':
          console.log('[WebSocket Manager] Welcome:', message.message);
          break;

        case 'vacancy:new':
          this.handleNewVacancy(message.data);
          break;

        case 'search:results':
          this.handleSearchResults(message.data);
          break;

        case 'pong':
          break;

        case 'error':
          console.error('[WebSocket Manager] Server error:', message.data.message);
          break;

        default:
          console.warn('[WebSocket Manager] Unhandled message type:', message.type);
      }
    } catch (error) {
      console.error('[WebSocket Manager] Unexpected error processing message:', error);
    }
  }

  /**
   * Обработка закрытия соединения
   */
  onClose(event) {
    if (this.disabled) return;

    console.warn(`[WebSocket Manager] Соединение закрыто (код: ${event.code})`);
    this.connected = false;
    this.stopHeartbeat();
    
    document.dispatchEvent(new CustomEvent('websocket:disconnected', {
      detail: { code: event.code, reason: event.reason }
    }));
    
    if (event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  /**
   * Обработка ошибок
   */
  onError(error) {
    if (this.disabled) return;

    console.error('[WebSocket Manager] WebSocket ошибка:', error);
    
    document.dispatchEvent(new CustomEvent('websocket:error', {
      detail: { error }
    }));
  }

  /**
   * Обработка новой вакансии
   */
  handleNewVacancy(vacancy) {
    console.log('📢 [WebSocket Manager] Новая вакансия:', vacancy.title);
    
    document.dispatchEvent(new CustomEvent('vacancy:new', {
      detail: vacancy,
      bubbles: true
    }));
  }

  /**
   * Обработка результатов поиска
   */
  handleSearchResults(data) {
    console.log(`🔍 [WebSocket Manager] Результаты поиска: ${data.results.length} из ${data.total}`);
    
    document.dispatchEvent(new CustomEvent('search:results', {
      detail: data
    }));
  }

  /**
   * Отправка сообщения на сервер
   */
  send(message) {
    if (this.disabled) return false;

    if (!this.connected || !this.ws) {
      console.warn('[WebSocket Manager] Нет соединения для отправки сообщения');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('[WebSocket Manager] Ошибка отправки сообщения:', error);
      return false;
    }
  }

  /**
   * Отправка поискового запроса
   */
  sendSearchQuery(query, category = 'all') {
    return this.send({
      type: 'search',
      data: { query, category }
    });
  }

  /**
   * Запуск heartbeat для проверки соединения
   */
  startHeartbeat() {
    if (this.disabled) return;

    this.heartbeatInterval = setInterval(() => {
      if (this.connected) {
        this.send({ type: 'ping' });
      }
    }, 30000);
  }

  /**
   * Остановка heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Планирование переподключения
   */
  scheduleReconnect() {
    if (this.disabled) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket Manager] Максимальное количество попыток переподключения превышено');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`[WebSocket Manager] Переподключение через ${delay}ms (попытка ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  /**
   * Принудительное закрытие соединения
   */
  disconnect() {
    if (this.disabled) return;

    console.log('[WebSocket Manager] Принудительное отключение');

    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    for (const [eventName, handler] of this.eventListeners) {
      document.removeEventListener(eventName, handler);
    }
    this.eventListeners.clear();

    if (this.ws) {
      this.ws.close(1000, 'Закрыто пользователем');
      this.ws = null;
    }
  }

  /**
   * Получение статуса соединения
   */
  getStatus() {
    return {
      disabled: this.disabled,
      connected: this.connected,
      url: this.wsUrl,
      reconnectAttempts: this.reconnectAttempts,
      readyState: this.ws ? this.ws.readyState : null
    };
  }
}

// Создаем глобальный экземпляр WebSocket Manager
// В production это будет отключено, в development - активно
window.wsManager = new WebSocketManager();

console.log('[WebSocket Manager] ✅ Инициализирован (production: disabled, development: active)');