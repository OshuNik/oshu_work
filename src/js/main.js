// Main entry point для Vite build system - Phase 3: Telegram Excellence
// Импортируем все необходимые модули в правильном порядке

// 1. Критичные модули конфигурации
import './env-dev.js';
import './env-config.js';
import './config.js';
import './constants.js';

// 2. NEW Phase 3: Telegram и Performance модули (загружаем первыми)
import './telegram-integration.js';
import './smart-cache.js';

// 3. Утилиты и менеджеры
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

// Phase 3: Telegram Mini App Excellence - Инициализация
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 oshu://work v14.0.0 - Telegram Mini App Excellence');
  
  // 1. Инициализация CSP
  if (window.cspManager) {
    window.cspManager.init();
  }
  
  // 2. Phase 3: Проверка Telegram интеграции
  if (window.telegramIntegration) {
    console.log('📱 Telegram Integration активирован');
    
    // Применяем Telegram-specific optimizations
    if (window.telegramIntegration.isInTelegram()) {
      document.body.classList.add('telegram-miniapp');
      console.log('✅ Запущено в Telegram Mini App');
    }
  }
  
  // 3. Phase 3: Smart Cache готовность
  if (window.smartCache) {
    console.log('📦 Smart Cache Manager готов');
  }
  
  // 4. Проверка что все модули загружены
  const requiredModules = [
    'appController',
    'stateManager', 
    'apiService',
    'domManager',
    'vacancyManager'
  ];
  
  // Phase 3: Добавляем новые модули в проверку
  const phase3Modules = [
    'telegramIntegration',
    'smartCache'
  ];
  
  const missingCore = requiredModules.filter(module => !window[module]);
  const missingPhase3 = phase3Modules.filter(module => !window[module]);
  
  if (missingCore.length > 0) {
    console.error('❌ Missing core modules:', missingCore);
  }
  
  if (missingPhase3.length > 0) {
    console.warn('⚠️ Missing Phase 3 modules:', missingPhase3);
  }
  
  if (missingCore.length === 0) {
    console.log('✅ All core modules loaded successfully');
    
    // Phase 3: Дополнительная инициализация
    initPhase3Features();
  }
});

// Phase 3: Инициализация продвинутых возможностей
function initPhase3Features() {
  // Telegram-specific инициализация
  if (window.telegramIntegration?.isInTelegram()) {
    // Настройка haptic feedback для кнопок
    document.querySelectorAll('.card-action-btn, .header-button, .tab-button').forEach(btn => {
      btn.addEventListener('click', () => {
        window.telegramIntegration.hapticFeedback('light');
      });
    });
    
    // Performance monitoring для Telegram
    if ('performance' in window) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const perfData = performance.getEntriesByType('navigation')[0];
          const loadTime = perfData.loadEventEnd - perfData.fetchStart;
          
          console.log(`⚡ Load time: ${Math.round(loadTime)}ms`);
          
          // Отправляем метрики в Telegram если нужно
          if (loadTime > 2000) {
            console.warn('⚠️ Медленная загрузка в Telegram Mini App');
          }
        }, 0);
      });
    }
  }
  
  // Smart Cache предварительная загрузка
  if (window.smartCache) {
    // Запускаем prefetch для популярных страниц в фоне
    setTimeout(() => {
      window.smartCache.preloadCriticalAssets();
    }, 1000);
  }
  
  console.log('🎉 Phase 3: Telegram Mini App Excellence - готов!');
}