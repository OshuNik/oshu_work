// Main entry point для Vite - Phase 3.2 Real-time Features
console.log('🚀 oshu://work v14.0.1 Phase 3.2 - loading...');

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
  console.log('✅ oshu://work v14.0.1 Phase 3.2 ready!');
  
  // Инициализация CSP
  if (window.cspManager) {
    window.cspManager.init();
  }
  
  // Проверка основных модулей
  const coreModules = ['appController', 'stateManager', 'vacancyManager'];
  const missing = coreModules.filter(module => !window[module]);
  
  if (missing.length === 0) {
    console.log('✅ Core modules loaded successfully');
    
    // Phase 3.2: Инициализация WebSocket после загрузки основных модулей
    if (window.wsManager) {
      console.log('✅ WebSocket Manager готов к работе');
      
      // Подписываемся на активную категорию при запуске
      const activeCategory = window.stateManager?.getCurrentCategory() || 'ТОЧНО ТВОЁ';
      window.wsManager.subscribeToCategory(activeCategory);
      
      // Добавляем обработчики WebSocket событий
      setupWebSocketHandlers();
    } else {
      console.warn('⚠️ WebSocket Manager не загружен, работаем без real-time функций');
    }
  } else {
    console.error('❌ Missing modules:', missing);
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
      console.log(`[Phase 3.2] Переключились на категорию: ${newCategory}`);
    }
  });
  
  // Статус подключения WebSocket
  document.addEventListener('ws:connected', () => {
    console.log('🟢 [Phase 3.2] WebSocket подключен - real-time функции активны');
    
    // Показываем индикатор подключения в UI
    showConnectionStatus('connected');
  });
  
  document.addEventListener('ws:disconnected', (event) => {
    console.warn('🔴 [Phase 3.2] WebSocket отключен:', event.detail?.reason);
    
    // Показываем индикатор отключения в UI
    showConnectionStatus('disconnected', event.detail?.reason);
  });
  
  // Fallback когда WebSocket недоступен
  document.addEventListener('ws:fallback', (event) => {
    console.info('📱 [Phase 3.2] Работаем без WebSocket - pull-to-refresh активен');
    showConnectionStatus('fallback', event.detail?.reason);
  });
}

/**
 * Показ статуса подключения в интерфейсе
 */
function showConnectionStatus(status, reason = '') {
  const statusEl = document.querySelector('.connection-status');
  if (!statusEl) {
    // Создаем элемент статуса если его нет
    const statusDiv = document.createElement('div');
    statusDiv.className = 'connection-status';
    statusDiv.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      transition: opacity 0.3s;
    `;
    document.body.appendChild(statusDiv);
  }
  
  const statusElement = document.querySelector('.connection-status');
  
  switch (status) {
    case 'connected':
      statusElement.textContent = '🟢 Live';
      statusElement.style.backgroundColor = '#4CAF50';
      statusElement.style.color = 'white';
      // Скрываем через 3 секунды
      setTimeout(() => {
        statusElement.style.opacity = '0';
      }, 3000);
      break;
      
    case 'disconnected':
      statusElement.textContent = '🔴 Offline';
      statusElement.style.backgroundColor = '#f44336';
      statusElement.style.color = 'white';
      statusElement.style.opacity = '1';
      break;
      
    case 'fallback':
      statusElement.textContent = '📱 Manual';
      statusElement.style.backgroundColor = '#FF9800';
      statusElement.style.color = 'white';
      // Скрываем через 5 секунд
      setTimeout(() => {
        statusElement.style.opacity = '0';
      }, 5000);
      break;
  }
}