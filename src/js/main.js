// Main entry point для Vite - восстановленная версия
console.log('🚀 oshu://work v14.0.0 - loading...');

// Импортируем основные модули
import './config.js';
import './constants.js';
import './csp-manager.js';

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

// Telegram интеграция
import './telegram-integration.js';
import './smart-cache.js';

// Дополнительные модули
import './theme-manager.js';
import './swipe-handler.js';

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
  console.log('✅ oshu://work v14.0.0 ready!');
  
  // Инициализация CSP
  if (window.cspManager) {
    window.cspManager.init();
  }
  
  // Проверка основных модулей
  const coreModules = ['appController', 'stateManager', 'vacancyManager'];
  const missing = coreModules.filter(module => !window[module]);
  
  if (missing.length === 0) {
    console.log('✅ Core modules loaded successfully');
  } else {
    console.error('❌ Missing modules:', missing);
  }
});