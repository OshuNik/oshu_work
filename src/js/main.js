// Main entry point для Vite - Phase 3.2 Simplified + Security Fixes
console.log('🚀 [MAIN] oshu://work v15.2.0 loading...');

// Импортируем основные модули
import './config.js';
import './constants.js';
import './debug-logger.js'; // Умный логгер - первым после config
import './csp-manager.js';
import './error-monitor.js';
import './error-helpers.js';

// ✅ Security & Performance Modules (NEW)
import './sanitizer.js';           // XSS Protection
import './error-boundary.js';      // Global error handler
import './pagination-manager.js';  // Pagination & infinite scroll

// Supabase клиент для Realtime
import './supabase-client.js';
import './realtime-manager.js'; // Realtime подписки на новые вакансии

// Utils модули (КРИТИЧЕСКИ ВАЖНО - содержит createVacancyCard, renderEmptyState)
import './utils.min.js';
import './utils-xss-patch.js';   // ✅ XSS Patch для utils.min.js
import './utils-empty-state.js';
import './utils-image-button-debug.js'; // 🐛 DEBUG: Image button logging

// Core модули  
import './websocket-manager.js'; // WebSocket для получения новых вакансий
import './state-manager.js';
import './api-service.js';
import './dom-manager.js';
import './event-manager.js';
import './vacancy-manager.js';
import './app-controller.js';

// Phase 3.1: Telegram интеграция и кеширование
import './telegram-integration.js';
import './smart-cache.js';

// Phase 3.2: Simplified Features (только уведомления и real-time поиск)
import './realtime-search.js';       // Real-time поиск работает
import './bot-integration.js';       // Уведомления работают

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
    
    // Phase 3.2: Упрощенные функции (только уведомления и поиск)
    console.log('✅ [Phase 3.2] Упрощенная версия - только уведомления и real-time поиск');
  } else {
    // Ошибка: не все модули загружены
  }
});

// Приложение готово к работе