// Settings page entry point для Vite
// Импортируем все необходимые модули

// 1. Критичные модули
import './csp-manager.js';
import './env-dev.js';
import './env-config.js';
import './config.js';

// 2. UI модули  
import './theme-manager.js';

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
  console.log('⚙️ Settings page initialized via Vite');
  
  if (window.cspManager) {
    window.cspManager.init();
  }
});