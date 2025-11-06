/**
 * Realtime Manager для получения новых вакансий из Supabase
 * Подписывается на INSERT события в таблице vacancies
 */

class RealtimeManager {
  constructor() {
    this.channel = null;
    this.isSubscribed = false;
    this.retryAttempts = 0;
    this.maxRetries = 5; // 1s, 2s, 4s, 8s, 16s = 31s total
    this.reconnectTimeout = null;

    console.log('[Realtime Manager] Инициализирован');
    this.init();
  }

  async init() {
    // Ждем инициализации Supabase клиента
    await this.waitForSupabase();
    
    if (!window.supabaseClient) {
      console.error('[Realtime Manager] Supabase клиент недоступен');
      return;
    }

    this.setupVacancySubscription();
  }

  /**
   * Ожидание готовности Supabase клиента
   */
  async waitForSupabase() {
    let attempts = 0;
    while (!window.supabaseClient && attempts < 50) {
      console.log(`[Realtime Manager] Ожидание Supabase клиента... ${attempts + 1}/50`);
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (window.supabaseClient) {
      console.log('[Realtime Manager] ✅ Supabase клиент готов');
    } else {
      console.error('[Realtime Manager] ❌ Timeout ожидания Supabase клиента');
    }
  }

  /**
   * Настройка подписки на новые вакансии
   */
  setupVacancySubscription() {
    try {
      console.log('[Realtime Manager] Настройка подписки на таблицу vacancies...');

      // Создаем канал для подписки на изменения в таблице vacancies
      this.channel = window.supabaseClient
        .channel('vacancies-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'vacancies'
          },
          (payload) => this.handleNewVacancy(payload)
        )
        .on(
          'postgres_changes', 
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'vacancies'
          },
          (payload) => this.handleVacancyUpdate(payload)
        )
        .subscribe((status) => {
          console.log('[Realtime Manager] Статус подписки:', status);
          
          if (status === 'SUBSCRIBED') {
            this.isSubscribed = true;
            console.log('✅ [Realtime Manager] Подписка на вакансии активна');
            
            // Уведомляем приложение о готовности realtime
            document.dispatchEvent(new CustomEvent('realtime:ready', {
              detail: { channel: 'vacancies-changes' }
            }));
            
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ [Realtime Manager] Ошибка канала realtime');
            this.handleSubscriptionError();
            
          } else if (status === 'TIMED_OUT') {
            console.error('⏰ [Realtime Manager] Timeout подписки realtime');
            this.handleSubscriptionError();
          }
        });

    } catch (error) {
      console.error('[Realtime Manager] Ошибка настройки подписки:', error);
      this.handleSubscriptionError();
    }
  }

  /**
   * Обработка новой вакансии с проверкой дублирования
   */
  handleNewVacancy(payload) {
    const vacancy = payload.new;

    // Check for duplicates via VacancyManager
    const vacancyManager = window.vacancyManager;
    if (vacancyManager && vacancyManager.isVacancyLoaded) {
      // Check across all categories (must match state-manager.js)
      const categoryKeys = ['main', 'maybe', 'other'];
      const isDuplicate = categoryKeys.some(key =>
        vacancyManager.isVacancyLoaded(key, vacancy.id)
      );

      if (isDuplicate) {
        console.debug(`[Realtime Manager] Ignoring duplicate vacancy: ${vacancy.id}`);
        return;
      }

      // Mark as loaded in all categories (realtime is global)
      categoryKeys.forEach(key => {
        vacancyManager.markVacancyLoaded(key, vacancy.id);
      });
    }

    console.log('🎯 [Realtime Manager] Новая вакансия получена:', {
      id: vacancy.id,
      title: vacancy.reason || vacancy.text_highlighted || 'Без названия',
      category: vacancy.ai_category,
      timestamp: vacancy.created_at
    });

    // Dispatch event for notifications system
    document.dispatchEvent(new CustomEvent('vacancy:new', {
      detail: {
        id: vacancy.id,
        title: vacancy.reason || vacancy.text_highlighted || 'Без названия',
        text: vacancy.text_highlighted || vacancy.text || '',
        category: vacancy.ai_category || 'НЕ ТВОЁ',
        company: vacancy.company_name || '',
        industry: vacancy.industry || '',
        reason: vacancy.reason || '',
        is_new: true,
        timestamp: vacancy.created_at,
        source: 'realtime'
      },
      bubbles: true
    }));

    console.log('📡 [Realtime Manager] Событие vacancy:new отправлено');
  }

  /**
   * Обработка обновления вакансии
   */
  handleVacancyUpdate(payload) {
    const vacancy = payload.new;
    console.log('🔄 [Realtime Manager] Обновление вакансии:', {
      id: vacancy.id,
      title: vacancy.reason || 'Без названия'
    });

    // Можно добавить обработку обновлений если нужно
    document.dispatchEvent(new CustomEvent('vacancy:updated', {
      detail: vacancy,
      bubbles: true
    }));
  }

  /**
   * Вычисление задержки для exponential backoff
   * Attempt 1 -> 1s, Attempt 2 -> 2s, Attempt 3 -> 4s, etc.
   */
  getBackoffDelay(attempt) {
    return Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s, 8s, 16s...
  }

  /**
   * Обработка ошибок подписки с exponential backoff
   */
  async handleSubscriptionError() {
    this.isSubscribed = false;

    // Clear any pending reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.retryAttempts < this.maxRetries) {
      this.retryAttempts++;
      const delay = this.getBackoffDelay(this.retryAttempts);
      const delaySeconds = (delay / 1000).toFixed(1);

      console.warn(
        `⚠️ [Realtime Manager] Ошибка подписки. ` +
        `Попытка переподключения ${this.retryAttempts}/${this.maxRetries} ` +
        `через ${delaySeconds}s...`
      );

      // Schedule reconnection with exponential backoff
      this.reconnectTimeout = setTimeout(() => {
        console.log(`[Realtime Manager] Переподключение (попытка ${this.retryAttempts})...`);
        this.setupVacancySubscription();
      }, delay);
    } else {
      console.error(
        '[Realtime Manager] ❌ Превышено максимальное количество попыток подключения ' +
        `(${this.maxRetries}). Realtime отключена.`
      );

      // Notify app that realtime failed permanently
      document.dispatchEvent(new CustomEvent('realtime:failed', {
        detail: {
          reason: 'max_retries_exceeded',
          attempts: this.retryAttempts,
          totalTime: `${(this.maxRetries * (this.maxRetries + 1) / 2)}s`
        }
      }));
    }
  }

  /**
   * Получение статуса подписки
   */
  getStatus() {
    return {
      isSubscribed: this.isSubscribed,
      retryAttempts: this.retryAttempts,
      channelState: this.channel?.state || null
    };
  }

  /**
   * Принудительное отключение
   */
  disconnect() {
    // Clear pending reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.channel) {
      console.log('[Realtime Manager] Отключение канала...');
      window.supabaseClient?.removeChannel(this.channel);
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.isSubscribed = false;
  }

  /**
   * Переподключение
   */
  reconnect() {
    console.log('[Realtime Manager] Переподключение...');
    this.disconnect();
    this.retryAttempts = 0;
    this.setupVacancySubscription();
  }

  /**
   * ✅ Полная очистка (cleanup) - устраняет memory leaks
   */
  cleanup() {
    console.log('[Realtime Manager] 🧹 Полная очистка...');

    // Отключить канал
    this.disconnect();

    // Очистить retry attempts
    this.retryAttempts = 0;
    this.maxRetries = 0; // Prevent reconnect

    console.log('[Realtime Manager] ✅ Cleanup завершен');
  }

  /**
   * ✅ Настройка автоматической очистки при навигации
   */
  setupAutoCleanup() {
    // Cleanup при закрытии страницы/вкладки
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // Cleanup при переходе на другую страницу (для SPA)
    window.addEventListener('pagehide', () => {
      this.cleanup();
    });

    // Cleanup при долгом нахождении в background (опционально)
    let backgroundTimeout = null;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // Отложенный cleanup если > 5 минут в background
        backgroundTimeout = setTimeout(() => {
          if (document.visibilityState === 'hidden') {
            console.log('[Realtime Manager] App долго в background, cleanup...');
            this.cleanup();
          }
        }, 300000); // 5 минут
      } else {
        // Вернулись в foreground - отменить cleanup
        if (backgroundTimeout) {
          clearTimeout(backgroundTimeout);
          backgroundTimeout = null;
        }

        // Если канал отключен - переподключиться
        if (!this.isSubscribed && this.maxRetries > 0) {
          console.log('[Realtime Manager] Возвращение из background, переподключение...');
          this.reconnect();
        }
      }
    });

    console.log('[Realtime Manager] ✅ Auto cleanup настроен');
  }
}

// Создаем глобальный экземпляр
window.realtimeManager = new RealtimeManager();

// ✅ Активировать автоматическую очистку для предотвращения memory leaks
window.realtimeManager.setupAutoCleanup();

console.log('[Realtime Manager] ✅ Глобальный realtimeManager создан с auto cleanup');