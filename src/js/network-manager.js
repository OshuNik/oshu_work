// network-manager.js — менеджер сетевого состояния и offline режима

(function() {
  'use strict';

  const UTIL = window.utils || {};

  class NetworkManager {
    constructor() {
      this.isOnline = navigator.onLine;
      this.offlineIndicator = null;
      this.retryQueue = [];
      this.maxRetries = 3;
      this.retryDelay = 1000; // 1 секунда

      this.init();
    }

    // Инициализация
    init() {
      this.createOfflineIndicator();
      this.bindNetworkEvents();
      
      // Проверяем статус при запуске
      this.updateNetworkStatus();
    }

    // Создать индикатор offline режима
    createOfflineIndicator() {
      this.offlineIndicator = document.createElement('div');
      this.offlineIndicator.className = 'offline-indicator hidden';
      this.offlineIndicator.innerHTML = `
        <div class="offline-content">
          <span class="offline-icon">📶</span>
          <span class="offline-text">Нет подключения к интернету</span>
          <button class="offline-retry-btn" type="button">Повторить</button>
        </div>
      `;

      // Добавляем в body
      document.body.appendChild(this.offlineIndicator);

      // Обработчик кнопки повтора
      const retryBtn = this.offlineIndicator.querySelector('.offline-retry-btn');
      retryBtn?.addEventListener('click', () => {
        this.checkConnection();
      });
    }

    // Привязать события сети
    bindNetworkEvents() {
      window.addEventListener('online', () => {
        this.handleOnline();
      });

      window.addEventListener('offline', () => {
        this.handleOffline();
      });

      // Периодическая проверка подключения
      setInterval(() => {
        this.checkConnection();
      }, 30000); // Каждые 30 секунд
    }

    // Обработать переход в online
    handleOnline() {
      this.isOnline = true;
      this.hideOfflineIndicator();
      this.processRetryQueue();

      if (UTIL.uiToast) {
        UTIL.uiToast('Подключение восстановлено', { timeout: 2000 });
      }
    }

    // Обработать переход в offline
    handleOffline() {
      this.isOnline = false;
      this.showOfflineIndicator();

      if (UTIL.uiToast) {
        UTIL.uiToast('Отсутствует подключение к интернету', { 
          timeout: 0 // Не скрывать автоматически
        });
      }
    }

    // Показать индикатор offline
    showOfflineIndicator() {
      if (this.offlineIndicator) {
        this.offlineIndicator.classList.remove('hidden');
        this.offlineIndicator.classList.add('visible');
      }
    }

    // Скрыть индикатор offline
    hideOfflineIndicator() {
      if (this.offlineIndicator) {
        this.offlineIndicator.classList.remove('visible');
        this.offlineIndicator.classList.add('hidden');
      }
    }

    // Проверить подключение
    async checkConnection() {
      try {
        const response = await fetch('/favicon.ico', {
          method: 'HEAD',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok && !this.isOnline) {
          this.handleOnline();
        }
      } catch (error) {
        if (this.isOnline) {
          this.handleOffline();
        }
      }
    }

    // Добавить запрос в очередь повтора
    addToRetryQueue(request) {
      if (this.retryQueue.length < 10) { // Лимит очереди
        this.retryQueue.push({
          ...request,
          timestamp: Date.now(),
          attempts: 0
        });
      }
    }

    // Обработать очередь повтора
    async processRetryQueue() {
      if (!this.isOnline || this.retryQueue.length === 0) {
        return;
      }

      const queue = [...this.retryQueue];
      this.retryQueue = [];

      for (const request of queue) {
        if (request.attempts < this.maxRetries) {
          try {
            await this.retryRequest(request);
          } catch (error) {
            request.attempts++;
            if (request.attempts < this.maxRetries) {
              this.retryQueue.push(request);
            }
          }
        }
      }
    }

    // Повторить запрос
    async retryRequest(request) {
      const delay = this.retryDelay * Math.pow(2, request.attempts);
      await new Promise(resolve => setTimeout(resolve, delay));

      if (request.callback && typeof request.callback === 'function') {
        return request.callback();
      }
    }

    // Обновить статус сети
    updateNetworkStatus() {
      const currentStatus = navigator.onLine;
      
      if (currentStatus !== this.isOnline) {
        if (currentStatus) {
          this.handleOnline();
        } else {
          this.handleOffline();
        }
      }
    }

    // Получить статус сети
    getNetworkStatus() {
      return {
        isOnline: this.isOnline,
        queueSize: this.retryQueue.length
      };
    }

    // Очистить очередь повтора
    clearRetryQueue() {
      this.retryQueue = [];
    }

    // Уничтожить менеджер
    destroy() {
      if (this.offlineIndicator) {
        this.offlineIndicator.remove();
      }

      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);

      this.clearRetryQueue();
    }
  }

  // Создаем глобальный экземпляр
  window.networkManager = new NetworkManager();

})();