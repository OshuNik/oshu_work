// Favorites page entry point для Vite
// Импортируем все необходимые модули

// 1. Критичные модули
import './env-dev.js';
import './env-config.js';
import './config.js';
import './constants.js';
import './debug-logger.js'; // Умный логгер
import './utils.min.js';
import './csp-manager.js';
import './error-monitor.js';
import './error-helpers.js';

// 2. UI модули
import './theme-manager.js';
import './utils-empty-state.js';

// 3. Основной модуль страницы
import './favorites.js';

// 4. Дополнительные модули
import './swipe-handler.js';

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
  console.log('💜 Favorites page initialized via Vite');
  
  if (window.cspManager) {
    window.cspManager.init();
  }
});