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
import './vacancy-simulator.js';

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
      let activeCategory = 'ТОЧНО ТВОЁ'; // По умолчанию
      
      // Безопасная попытка получить текущую категорию
      try {
        if (window.stateManager && typeof window.stateManager.getCurrentCategory === 'function') {
          activeCategory = window.stateManager.getCurrentCategory() || 'ТОЧНО ТВОЁ';
        }
      } catch (error) {
        console.warn('[Phase 3.2] Не удалось получить текущую категорию:', error);
      }
      
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
    
    // Запускаем симулятор для демонстрации live функций
    if (window.vacancySimulator && !window.vacancySimulator.isActive) {
      console.log('🎭 [Phase 3.2] Запускаем симулятор новых вакансий для демонстрации');
      window.vacancySimulator.start();
      
      // Показываем уведомление пользователю
      setTimeout(() => {
        showSimulatorNotification();
      }, 5000);
    }
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

/**
 * Показ уведомления о симуляторе новых вакансий
 */
function showSimulatorNotification() {
  // Создаем toast уведомление
  const toast = document.createElement('div');
  toast.className = 'toast toast-info';
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-icon">🎭</div>
      <div class="toast-message">
        <strong>Demo режим активен</strong><br>
        Новые вакансии будут появляться автоматически каждые 45 секунд для демонстрации live функций
      </div>
    </div>
  `;
  
  toast.style.cssText = `
    position: fixed;
    top: 60px;
    left: 50%;
    transform: translateX(-50%);
    background: #2196F3;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    max-width: 320px;
    animation: slideDown 0.3s ease-out;
  `;
  
  document.body.appendChild(toast);
  
  // Убираем через 8 секунд
  setTimeout(() => {
    toast.style.animation = 'slideUp 0.3s ease-in forwards';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 8000);
}

// Добавляем CSS анимации для toast
if (!document.querySelector('#simulator-toast-styles')) {
  const style = document.createElement('style');
  style.id = 'simulator-toast-styles';
  style.textContent = `
    @keyframes slideDown {
      from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
      to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    
    @keyframes slideUp {
      from { transform: translateX(-50%) translateY(0); opacity: 1; }
      to { transform: translateX(-50%) translateY(-20px); opacity: 0; }
    }
    
    .toast-content {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    
    .toast-icon {
      font-size: 18px;
      flex-shrink: 0;
    }
    
    .toast-message {
      font-size: 13px;
      line-height: 1.4;
    }
  `;
  document.head.appendChild(style);
}