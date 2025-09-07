/**
 * WebSocket Manager для получения новых вакансий из каналов
 * Подключается к backend WebSocket серверу для real-time обновлений
 */

class WebSocketManager {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // 1 секунда
    this.heartbeatInterval = null;
    
    // URL WebSocket сервера
    this.wsUrl = this.getWebSocketUrl();
    
    console.log('[WebSocket Manager] Инициализирован с URL:', this.wsUrl);
    this.connect();
  }

  /**
   * Определяет URL WebSocket сервера в зависимости от окружения
   */
  getWebSocketUrl() {
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
                       
    if (isLocalhost) {
      // Для разработки - подключаемся к mock серверу
      return 'ws://localhost:8080/ws';
    } else {
      // Для production - здесь должен быть реальный WebSocket сервер
      // TODO: Настроить production WebSocket сервер
      console.warn('[WebSocket Manager] Production WebSocket сервер не настроен');
      return null;
    }
  }

  /**
   * Подключение к WebSocket серверу
   */
  connect() {
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
    console.log('✅ [WebSocket Manager] Подключение установлено');
    this.connected = true;
    this.reconnectAttempts = 0;
    
    // Запускаем heartbeat
    this.startHeartbeat();
    
    // Уведомляем приложение о подключении
    document.dispatchEvent(new CustomEvent('websocket:connected', {
      detail: { url: this.wsUrl }
    }));
  }

  /**
   * Обработка входящих сообщений
   */
  onMessage(event) {
    try {
      const message = JSON.parse(event.data);
      console.log('[WebSocket Manager] Получено сообщение:', message.type);
      
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
          // Heartbeat ответ
          break;
          
        default:
          console.warn('[WebSocket Manager] Неизвестный тип сообщения:', message.type);
      }
      
    } catch (error) {
      console.error('[WebSocket Manager] Ошибка парсинга сообщения:', error);
    }
  }

  /**
   * Обработка закрытия соединения
   */
  onClose(event) {
    console.warn(`[WebSocket Manager] Соединение закрыто (код: ${event.code})`);
    this.connected = false;
    this.stopHeartbeat();
    
    // Уведомляем приложение о разрыве соединения
    document.dispatchEvent(new CustomEvent('websocket:disconnected', {
      detail: { code: event.code, reason: event.reason }
    }));
    
    // Пытаемся переподключиться
    if (event.code !== 1000) { // Не переподключаемся при нормальном закрытии
      this.scheduleReconnect();
    }
  }

  /**
   * Обработка ошибок
   */
  onError(error) {
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
    
    // Отправляем событие vacancy:new для уведомлений и UI
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
    
    // Отправляем событие для компонента поиска
    document.dispatchEvent(new CustomEvent('search:results', {
      detail: data
    }));
  }

  /**
   * Отправка сообщения на сервер
   */
  send(message) {
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
    this.heartbeatInterval = setInterval(() => {
      if (this.connected) {
        this.send({ type: 'ping' });
      }
    }, 30000); // Каждые 30 секунд
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
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket Manager] Максимальное количество попыток переподключения превышено');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts); // Exponential backoff
    this.reconnectAttempts++;
    
    console.log(`[WebSocket Manager] Переподключение через ${delay}ms (попытка ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Принудительное закрытие соединения
   */
  disconnect() {
    console.log('[WebSocket Manager] Принудительное отключение');
    
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Закрыто пользователем');
    }
  }

  /**
   * Получение статуса соединения
   */
  getStatus() {
    return {
      connected: this.connected,
      url: this.wsUrl,
      reconnectAttempts: this.reconnectAttempts,
      readyState: this.ws ? this.ws.readyState : null
    };
  }
}

// Создаем глобальный экземпляр WebSocket Manager
window.wsManager = new WebSocketManager();

console.log('[WebSocket Manager] ✅ Глобальный wsManager создан');