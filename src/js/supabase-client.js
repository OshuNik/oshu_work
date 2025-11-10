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
        
        // Проверяем доступность Supabase UMD (должен быть загружен через script tag)
        if (!window.supabase) {
          console.error('[Supabase] UMD библиотека не найдена в window.supabase');
          this.dispatchFallback('sdk_missing');
          return;
        }
        
        // Создаем клиент используя UMD версию
        const { createClient } = window.supabase;
        this.client = createClient(
          CFG.SUPABASE_URL,
          CFG.SUPABASE_ANON_KEY,
          {
            realtime: {
              params: {
                eventsPerSecond: 10
              },
              // ✅ FIX: Add reconnection configuration
              timeout: 30000,  // 30s timeout for WebSocket
              maxAttempts: 10,  // Max 10 reconnection attempts
              retryDelayMs: (attempt) => {
                // Exponential backoff: 1s, 2s, 4s, 8s, 16s... (cap at 30s)
                return Math.min(1000 * Math.pow(2, attempt - 1), 30000);
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
  console.log('🔧 [Supabase] Начинаем инициализацию Supabase Manager...');
  window.supabaseManager = new SupabaseClientManager();
  
  console.log('✅ [Supabase] Manager инициализирован');
  
})();