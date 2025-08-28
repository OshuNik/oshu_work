// Main entry point для Vite build system
// Импортируем все необходимые модули в правильном порядке

// 1. Критичные модули конфигурации
import './env-dev.js';
import './env-config.js';
import './config.js';
import './constants.js';

// 2. Утилиты и менеджеры
import './utils.min.js';
import './csp-manager.js';
import './theme-manager.js';
import './template-loader.js';
import './utils-empty-state.js';
import './utils-link-handler.js';

// 3. Основная архитектура (в порядке зависимостей)
import './state-manager.js';
import './api-service.js';
import './network-manager.js';
import './dom-manager.js';
import './event-manager.js';
import './vacancy-manager.js';

// 4. Контроллер приложения
import './app-controller.js';

// 5. Дополнительные модули
import './swipe-handler.js';

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 oshu://work app initialized via Vite');
  
  // Инициализация CSP
  if (window.cspManager) {
    window.cspManager.init();
  }
  
  // Проверка что все модули загружены
  const requiredModules = [
    'appController',
    'stateManager',
    'apiService',
    'domManager',
    'vacancyManager'
  ];
  
  const missingModules = requiredModules.filter(module => !window[module]);
  if (missingModules.length > 0) {
    console.error('❌ Missing modules:', missingModules);
  } else {
    console.log('✅ All core modules loaded successfully');
  }
});