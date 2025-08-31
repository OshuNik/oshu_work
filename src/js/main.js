// Main entry point для Vite - Phase 3.2 Real-time Features
console.log('🚀 [MAIN] oshu://work v14.0.1 Phase 3.2 loading...');

// Импортируем основные модули
import './config.js';
import './constants.js';
import './csp-manager.js';

// Supabase клиент для Realtime
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

// Дополнительные модули
import './theme-manager.js';
import './swipe-handler.js';

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
  console.log('✅ [MAIN] DOMContentLoaded - приложение готово к инициализации');
  
  // Инициализация CSP
  if (window.cspManager) {
    window.cspManager.init();
  }
  
  // Проверка основных модулей
  const coreModules = ['appController', 'stateManager', 'vacancyManager'];
  const missing = coreModules.filter(module => !window[module]);
  
  if (missing.length === 0) {
    // Core modules loaded successfully
    
    // Phase 3.2: Real-time функции включены
    console.log('✅ [Phase 3.2] Real-time функции включены - тестируем Supabase интеграцию');
  } else {
    // Ошибка: не все модули загружены
  }
});

// WebSocket обработчики ВРЕМЕННО ОТКЛЮЧЕНЫ

// UI уведомления убраны - используется console.log для тестирования

// Toast уведомления убраны - используется console.log для тестирования