// Main entry point для Vite - Phase 3.2 Real-time Features
// oshu://work v14.0.1 Phase 3.2 loading

// Импортируем основные модули
import './config.js';
import './constants.js';
import './csp-manager.js';

// Supabase клиент для Realtime (загружается первым)
import './supabase-client.js';

// Utils модули (КРИТИЧЕСКИ ВАЖНО - содержит createVacancyCard, renderEmptyState)
import './utils.min.js';
import './utils-empty-state.js';

// Core модули  
import './state-manager.js';
import './api-service.js';
import './dom-manager.js';
import './event-manager.js';
import './vacancy-manager.js';
import './app-controller.js';

// Phase 3.1: Telegram интеграция и кеширование
import './telegram-integration.js';
import './smart-cache.js';

// Phase 3.2: Real-time Features
import './websocket-manager.js';
import './realtime-updates.js';
import './realtime-search.js';
import './bot-integration.js';
// import './vacancy-simulator.js'; // Убрано - используем только реальные вакансии

// Дополнительные модули
import './theme-manager.js';
import './swipe-handler.js';

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
  // oshu://work v14.0.1 Phase 3.2 ready
  
  // Инициализация CSP
  if (window.cspManager) {
    window.cspManager.init();
  }
  
  // Проверка основных модулей
  const coreModules = ['appController', 'stateManager', 'vacancyManager'];
  const missing = coreModules.filter(module => !window[module]);
  
  if (missing.length === 0) {
    // Core modules loaded successfully
    
    // Phase 3.2: Инициализация WebSocket после загрузки основных модулей
    if (window.wsManager) {
      // WebSocket Manager готов к работе
      
      // Подписываемся на активную категорию при запуске
      let activeCategory = 'ТОЧНО ТВОЁ'; // По умолчанию
      
      // Безопасная попытка получить текущую категорию
      try {
        if (window.stateManager && typeof window.stateManager.getCurrentCategory === 'function') {
          activeCategory = window.stateManager.getCurrentCategory() || 'ТОЧНО ТВОЁ';
        }
      } catch (error) {
        // Не удалось получить текущую категорию
      }
      
      window.wsManager.subscribeToCategory(activeCategory);
      
      // Добавляем обработчики WebSocket событий
      setupWebSocketHandlers();
    } else {
      // WebSocket Manager не загружен
    }
  } else {
    // Ошибка: не все модули загружены
  }
});

/**
 * Настройка обработчиков WebSocket событий
 */
function setupWebSocketHandlers() {
  // Обработка смены категорий для переподключения к нужным room'ам
  document.addEventListener('category-changed', (event) => {
    const newCategory = event.detail?.category;
    if (newCategory && window.wsManager) {
      window.wsManager.switchCategory(newCategory);
      // Переключились на категорию
    }
  });
  
  // Статус подключения WebSocket
  document.addEventListener('ws:connected', () => {
    console.log('🟢 [WebSocket] Live режим активен');
  });
  
  document.addEventListener('ws:disconnected', (event) => {
    console.log('🔴 [WebSocket] Offline режим, причина:', event.detail?.reason);
  });
  
  // Fallback когда WebSocket недоступен
  document.addEventListener('ws:fallback', (event) => {
    console.log('📱 [WebSocket] Fallback режим - только pull-to-refresh обновления');
    console.log('🔧 [Setup] Для live обновлений нужен WebSocket сервер:', event.detail?.reason);
  });
}

// UI уведомления убраны - используется console.log для тестирования

// Toast уведомления убраны - используется console.log для тестирования