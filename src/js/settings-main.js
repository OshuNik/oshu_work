// Settings page entry point для Vite
// Импортируем все необходимые модули

// 1. Критичные модули
import './csp-manager.js';
import './env-dev.js';
import './env-config.js';
import './config.js';
import './utils.min.js'; // Необходимо для window.utils
import './debug-logger.js'; // Умный логгер
import './error-monitor.js';
import './error-helpers.js';

// 2. UI модули  
import './theme-manager.js';
import './bot-integration.js';

// 3. Settings модули
import { SettingsMain } from '../modules/SettingsMain.js';

// Инициализация
document.addEventListener('DOMContentLoaded', async function() {
  console.log('⚙️ Settings page initialized via Vite');
  
  if (window.cspManager) {
    window.cspManager.init();
  }

  // Инициализация SettingsMain после загрузки всех зависимостей
  try {
    console.log('🔄 Starting settings initialization...');
    
    // Небольшая задержка для завершения всех импортов
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Проверяем что все зависимости загружены
    if (!window.APP_CONFIG || !window.utils) {
      console.error('❌ Dependencies not loaded:', {
        APP_CONFIG: !!window.APP_CONFIG,
        utils: !!window.utils
      });
      return;
    }
    
    console.log('🚀 Dependencies loaded successfully!');
    console.log('APP_CONFIG keys:', Object.keys(window.APP_CONFIG));
    console.log('utils keys:', Object.keys(window.utils));
    
    // Инициализируем главный модуль настроек
    console.log('🏗️ Creating SettingsMain instance...');
    window.settingsApp = new SettingsMain();
    
    // Запускаем инициализацию вручную (после загрузки зависимостей)
    console.log('🔄 Initializing settings manually...');
    await window.settingsApp.init();
    
    // Ждем полной инициализации
    let attempts = 0;
    while (!window.settingsApp.initialized && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (window.settingsApp.initialized) {
      console.log('✅ Settings initialized successfully:', window.settingsApp.getStats());
    } else {
      console.error('❌ Settings initialization timeout');
    }
    
  } catch (error) {
    console.error('❌ Settings initialization error:', error);
  }
});