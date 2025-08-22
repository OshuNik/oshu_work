// SettingsMain.js — главный модуль настроек

import { 
  checkDependencies,
  log,
  getElement
} from './SettingsUtils.js';
import { KeywordsManager } from './KeywordsManager.js';
import { ChannelsManager } from './ChannelsManager.js';
import { SettingsUI } from './SettingsUI.js';

/**
 * Главный класс настроек
 */
export class SettingsMain {
  constructor() {
    this.keywordsManager = null;
    this.channelsManager = null;
    this.ui = null;
    this.initialized = false;
    
    this.init();
  }

  /**
   * Инициализация главного модуля
   */
  async init() {
    try {
      // Проверяем зависимости
      if (!checkDependencies()) {
        throw new Error('Не все зависимости готовы');
      }

      // Инициализируем UI
      this.ui = new SettingsUI();
      
      // Инициализируем менеджеры
      this.keywordsManager = new KeywordsManager();
      this.channelsManager = new ChannelsManager();
      
      // Настраиваем связь между модулями
      this.setupModuleConnections();
      
      // Загружаем данные
      await this.loadData();
      
      this.initialized = true;
      log('log', 'SettingsMain успешно инициализирован');
      
    } catch (error) {
      log('error', 'Ошибка инициализации SettingsMain:', error);
      this.showError('Ошибка инициализации настроек');
    }
  }

  /**
   * Настроить связи между модулями
   */
  setupModuleConnections() {
    // Связываем UI события с менеджерами
    this.setupKeywordsEvents();
    this.setupChannelsEvents();
    
    // Связываем менеджеры с UI
    this.setupManagerCallbacks();
  }

  /**
   * Настроить события для ключевых слов
   */
  setupKeywordsEvents() {
    // Добавление ключевого слова
    document.addEventListener('addKeyword', (e) => {
      const { value } = e.detail;
      if (this.keywordsManager) {
        this.keywordsManager.addKeyword(value);
      }
    });

    // Добавление ключевых слов пачкой
    document.addEventListener('addBatchKeywords', (e) => {
      const { value } = e.detail;
      if (this.keywordsManager) {
        this.keywordsManager.addBatchKeywords(value);
      }
    });

    // Загрузка стандартных ключевых слов
    document.addEventListener('loadDefaultsKeywords', () => {
      if (this.keywordsManager) {
        this.loadKeywordsPreset();
      }
    });

    // Удаление всех ключевых слов
    document.addEventListener('clearAllKeywords', () => {
      if (this.keywordsManager) {
        this.keywordsManager.clearAllKeywords();
      }
    });
  }

  /**
   * Настроить события для каналов
   */
  setupChannelsEvents() {
    // Добавление канала
    document.addEventListener('addChannel', (e) => {
      const { value } = e.detail;
      if (this.channelsManager) {
        this.channelsManager.addChannel(value);
      }
    });

    // Загрузка стандартных каналов
    document.addEventListener('loadDefaultsChannels', () => {
      if (this.channelsManager) {
        this.channelsManager.loadDefaultChannels();
      }
    });

    // Удаление всех каналов
    document.addEventListener('deleteAllChannels', () => {
      if (this.channelsManager) {
        this.channelsManager.deleteAllChannels();
      }
    });
  }

  /**
   * Настроить обратные вызовы менеджеров
   */
  setupManagerCallbacks() {
    // Обновление счетчиков при изменении данных
    if (this.keywordsManager) {
      this.keywordsManager.onUpdate = () => {
        this.updateKeywordsCount();
      };
    }

    if (this.channelsManager) {
      this.channelsManager.onUpdate = () => {
        this.updateChannelsCount();
      };
    }
  }

  /**
   * Загрузить все данные
   */
  async loadData() {
    try {
      // Загружаем ключевые слова
      if (this.keywordsManager) {
        await this.keywordsManager.loadKeywords();
      }
      
      // Загружаем каналы
      if (this.channelsManager) {
        await this.channelsManager.loadChannels();
      }
      
      log('log', 'Все данные загружены');
    } catch (error) {
      log('error', 'Ошибка загрузки данных:', error);
    }
  }

  /**
   * Загрузить пресет ключевых слов
   */
  async loadKeywordsPreset() {
    try {
      // Показываем модальное окно с пресетами
      this.showPresetsModal();
    } catch (error) {
      log('error', 'Ошибка загрузки пресета ключевых слов:', error);
    }
  }

  /**
   * Показать модальное окно с пресетами
   */
  showPresetsModal() {
    const modal = getElement('presets-modal');
    if (modal) {
      modal.classList.add('active');
    }
  }

  /**
   * Закрыть модальное окно с пресетами
   */
  closePresetsModal() {
    const modal = getElement('presets-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  /**
   * Обновить счетчик ключевых слов
   */
  updateKeywordsCount() {
    if (this.keywordsManager) {
      const count = this.keywordsManager.getKeywordsCount();
      if (this.ui) {
        this.ui.updateCounter('keywords', count);
      }
    }
  }

  /**
   * Обновить счетчик каналов
   */
  updateChannelsCount() {
    if (this.channelsManager) {
      const count = this.channelsManager.getChannels().length;
      if (this.ui) {
        this.ui.updateCounter('channels', count);
      }
    }
  }

  /**
   * Показать ошибку
   * @param {string} message - Сообщение об ошибке
   */
  showError(message) {
    if (this.ui) {
      this.ui.showMessage(message, 'error');
    } else {
      console.error(message);
    }
  }

  /**
   * Показать сообщение
   * @param {string} message - Сообщение
   * @param {string} type - Тип сообщения
   */
  showMessage(message, type = 'info') {
    if (this.ui) {
      this.ui.showMessage(message, type);
    }
  }

  /**
   * Переключить вкладку
   * @param {string} tabId - ID вкладки
   */
  switchTab(tabId) {
    if (this.ui) {
      this.ui.switchTab(tabId);
    }
  }

  /**
   * Получить активную вкладку
   * @returns {string|null} ID активной вкладки
   */
  getActiveTab() {
    if (this.ui) {
      return this.ui.getActiveTab();
    }
    return null;
  }

  /**
   * Получить ключевые слова
   * @returns {Array} Массив ключевых слов
   */
  getKeywords() {
    if (this.keywordsManager) {
      return this.keywordsManager.getCurrentKeywords();
    }
    return [];
  }

  /**
   * Получить каналы
   * @returns {Array} Массив каналов
   */
  getChannels() {
    if (this.channelsManager) {
      return this.channelsManager.getChannels();
    }
    return [];
  }

  /**
   * Сохранить все данные
   */
  async saveAll() {
    try {
      if (this.keywordsManager) {
        await this.keywordsManager.saveKeywords();
      }
      
      log('log', 'Все данные сохранены');
      this.showMessage('Настройки сохранены', 'success');
    } catch (error) {
      log('error', 'Ошибка сохранения данных:', error);
      this.showError('Ошибка сохранения настроек');
    }
  }

  /**
   * Сбросить все настройки
   */
  async resetAll() {
    try {
      if (confirm('Сбросить все настройки? Это действие нельзя отменить.')) {
        // Очищаем ключевые слова
        if (this.keywordsManager) {
          await this.keywordsManager.clearAllKeywords();
        }
        
        // Очищаем каналы
        if (this.channelsManager) {
          await this.channelsManager.deleteAllChannels();
        }
        
        log('log', 'Все настройки сброшены');
        this.showMessage('Настройки сброшены', 'success');
      }
    } catch (error) {
      log('error', 'Ошибка сброса настроек:', error);
      this.showError('Ошибка сброса настроек');
    }
  }

  /**
   * Экспорт настроек
   * @returns {Object} Объект с настройками
   */
  exportSettings() {
    const settings = {
      keywords: this.getKeywords(),
      channels: this.getChannels(),
      timestamp: new Date().toISOString()
    };
    
    // Создаем файл для скачивания
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `oshu-settings-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    log('log', 'Настройки экспортированы');
    this.showMessage('Настройки экспортированы', 'success');
  }

  /**
   * Импорт настроек
   * @param {File} file - Файл с настройками
   */
  async importSettings(file) {
    try {
      const text = await file.text();
      const settings = JSON.parse(text);
      
      if (settings.keywords && Array.isArray(settings.keywords)) {
        if (this.keywordsManager) {
          this.keywordsManager.setKeywords(settings.keywords);
        }
      }
      
      if (settings.channels && Array.isArray(settings.channels)) {
        // Импорт каналов требует дополнительной логики
        log('warn', 'Импорт каналов не реализован');
      }
      
      log('log', 'Настройки импортированы');
      this.showMessage('Настройки импортированы', 'success');
    } catch (error) {
      log('error', 'Ошибка импорта настроек:', error);
      this.showError('Ошибка импорта настроек');
    }
  }

  /**
   * Получить статистику
   * @returns {Object} Объект со статистикой
   */
  getStats() {
    return {
      keywords: {
        count: this.getKeywords().length,
        manager: this.keywordsManager ? 'active' : 'inactive'
      },
      channels: {
        count: this.getChannels().length,
        manager: this.channelsManager ? 'active' : 'inactive'
      },
      ui: {
        active: this.ui ? 'active' : 'inactive',
        activeTab: this.getActiveTab()
      },
      initialized: this.initialized
    };
  }

  /**
   * Проверить состояние модулей
   * @returns {Object} Состояние модулей
   */
  checkModulesHealth() {
    const health = {
      keywordsManager: this.keywordsManager ? 'healthy' : 'missing',
      channelsManager: this.channelsManager ? 'healthy' : 'missing',
      ui: this.ui ? 'healthy' : 'missing',
      overall: 'healthy'
    };
    
    if (health.keywordsManager === 'missing' || 
        health.channelsManager === 'missing' || 
        health.ui === 'missing') {
      health.overall = 'degraded';
    }
    
    return health;
  }

  /**
   * Перезапустить модуль
   * @param {string} moduleName - Имя модуля для перезапуска
   */
  async restartModule(moduleName) {
    try {
      switch (moduleName) {
        case 'keywords':
          if (this.keywordsManager) {
            this.keywordsManager.cleanup();
            this.keywordsManager = new KeywordsManager();
            await this.keywordsManager.loadKeywords();
          }
          break;
          
        case 'channels':
          if (this.channelsManager) {
            this.channelsManager.cleanup();
            this.channelsManager = new ChannelsManager();
            await this.channelsManager.loadChannels();
          }
          break;
          
        case 'ui':
          if (this.ui) {
            this.ui.cleanup();
            this.ui = new SettingsUI();
          }
          break;
          
        default:
          throw new Error(`Неизвестный модуль: ${moduleName}`);
      }
      
      log('log', `Модуль ${moduleName} перезапущен`);
      this.showMessage(`Модуль ${moduleName} перезапущен`, 'success');
    } catch (error) {
      log('error', `Ошибка перезапуска модуля ${moduleName}:`, error);
      this.showError(`Ошибка перезапуска модуля ${moduleName}`);
    }
  }

  /**
   * Очистка ресурсов
   */
  cleanup() {
    try {
      if (this.keywordsManager) {
        this.keywordsManager.cleanup();
      }
      
      if (this.channelsManager) {
        this.channelsManager.cleanup();
      }
      
      if (this.ui) {
        this.ui.cleanup();
      }
      
      log('log', 'SettingsMain очищен');
    } catch (error) {
      log('error', 'Ошибка очистки SettingsMain:', error);
    }
  }
}

/**
 * Создать экземпляр SettingsMain
 * @returns {SettingsMain} Экземпляр главного модуля
 */
export function createSettingsMain() {
  return new SettingsMain();
}

/**
 * Глобальный экземпляр настроек
 */
let globalSettings = null;

/**
 * Инициализировать настройки
 */
export function initSettings() {
  if (!globalSettings) {
    globalSettings = new SettingsMain();
  }
  return globalSettings;
}

/**
 * Получить глобальный экземпляр настроек
 * @returns {SettingsMain|null} Глобальный экземпляр
 */
export function getSettings() {
  return globalSettings;
}

/**
 * Очистить глобальный экземпляр настроек
 */
export function cleanupSettings() {
  if (globalSettings) {
    globalSettings.cleanup();
    globalSettings = null;
  }
}

/**
 * Экспорт по умолчанию
 */
export default SettingsMain;
