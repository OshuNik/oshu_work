// Settings page entry point для Vite
// Импортируем все необходимые модули

// 0. CSS переменные первыми
import '../css/variables.css';

// 1. Критичные модули
import './csp-manager.js';
import './env-dev.js';
import './env-config.js';
import './config.js';
import './error-monitor.js';
import './error-helpers.js';

// 2. UI модули  
import './theme-manager.js';
import './bot-integration.js';

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
  console.log('⚙️ Settings page initialized via Vite');
  
  if (window.cspManager) {
    window.cspManager.init();
  }
});