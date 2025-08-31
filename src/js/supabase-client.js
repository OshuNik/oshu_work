/**
 * Supabase Client для Realtime подключения
 * Инициализирует Supabase SDK только для live обновлений
 */

(function() {
  'use strict';
  
  const CFG = window.APP_CONFIG || {};
  
  class SupabaseClientManager {
    constructor() {
      this.client = null;
      this.connected = false;
      this.init();
    }
    
    async init() {
      try {
        // Проверяем доступность конфигурации
        if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) {
          console.warn('[Supabase] Конфигурация недоступна');
          this.dispatchFallback('config_missing');
          return;
        }
        
        // Загружаем Supabase SDK
        await this.loadSupabaseSDK();
        
        // Создаем клиент
        this.client = window.supabase.createClient(
          CFG.SUPABASE_URL,
          CFG.SUPABASE_ANON_KEY,
          {
            realtime: {
              params: {
                eventsPerSecond: 10
              }
            }
          }
        );
        
        // Проверяем подключение
        const { error } = await this.client.auth.getSession();
        if (error) {
          console.warn('[Supabase] Ошибка сессии:', error.message);
        }
        
        this.connected = true;
        window.supabaseClient = this.client;
        
        console.log('[Supabase] ✅ Клиент инициализирован для Realtime');
        
      } catch (error) {
        console.error('[Supabase] Ошибка инициализации:', error);
        this.dispatchFallback('init_error');
      }
    }
    
    async loadSupabaseSDK() {
      if (window.supabase) {
        return; // Уже загружен
      }
      
      const cdnUrls = [
        'https://unpkg.com/@supabase/supabase-js@2.39.0/dist/umd/supabase.js',
        'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.js'
      ];
      
      for (const url of cdnUrls) {
        try {
          await this.loadScript(url);
          if (window.supabase) {
            console.log('[Supabase] SDK загружен с:', url);
            return;
          }
        } catch (error) {
          console.warn('[Supabase] Не удалось загрузить SDK с', url);
        }
      }
      
      throw new Error('Все CDN Supabase SDK недоступны');
    }
    
    loadScript(url) {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    
    dispatchFallback(reason) {
      const event = new CustomEvent('ws:fallback', {
        detail: { reason },
        bubbles: true
      });
      document.dispatchEvent(event);
    }
    
    getClient() {
      return this.client;
    }
    
    isConnected() {
      return this.connected && this.client;
    }
  }
  
  // Глобальная инициализация
  window.supabaseManager = new SupabaseClientManager();
  
  console.log('[Supabase] Manager инициализирован');
  
})();