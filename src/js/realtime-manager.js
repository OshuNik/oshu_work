/**
 * Realtime Manager для получения новых вакансий из Supabase
 * Подписывается на INSERT события в таблице vacancies
 */

class RealtimeManager {
  constructor() {
    this.channel = null;
    this.isSubscribed = false;
    this.retryAttempts = 0;
    this.maxRetries = 3;
    
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
   * Обработка новой вакансии
   */
  handleNewVacancy(payload) {
    const vacancy = payload.new;
    console.log('🎯 [Realtime Manager] Новая вакансия получена:', {
      id: vacancy.id,
      title: vacancy.reason || vacancy.text_highlighted || 'Без названия',
      category: vacancy.ai_category,
      timestamp: vacancy.created_at
    });

    // Диспетчим событие vacancy:new для системы уведомлений
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
   * Обработка ошибок подписки
   */
  handleSubscriptionError() {
    this.isSubscribed = false;
    
    if (this.retryAttempts < this.maxRetries) {
      this.retryAttempts++;
      console.log(`[Realtime Manager] Попытка повторного подключения ${this.retryAttempts}/${this.maxRetries}`);
      
      setTimeout(() => {
        this.setupVacancySubscription();
      }, 2000 * this.retryAttempts); // Exponential backoff
    } else {
      console.error('[Realtime Manager] ❌ Превышено максимальное количество попыток подключения');
      
      // Уведомляем о fallback на WebSocket или другие методы
      document.dispatchEvent(new CustomEvent('realtime:failed', {
        detail: { reason: 'max_retries_exceeded' }
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
    if (this.channel) {
      console.log('[Realtime Manager] Отключение канала...');
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
}

// Создаем глобальный экземпляр
window.realtimeManager = new RealtimeManager();

console.log('[Realtime Manager] ✅ Глобальный realtimeManager создан');