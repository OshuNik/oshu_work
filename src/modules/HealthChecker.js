// HealthChecker.js — Объект-метод для проверки состояния модулей

/**
 * Объект-метод для проверки состояния модулей SettingsMain
 * Применение паттерна "Replace Method with Method Object" из Context7
 */
export class HealthChecker {
  constructor(settingsMain) {
    this.settingsMain = settingsMain;
    this.health = {};
  }

  /**
   * Выполнить проверку состояния всех модулей
   * @returns {Object} Состояние модулей
   */
  perform() {
    this.initializeHealth();
    this.checkIndividualModules();
    this.calculateOverallHealth();
    return this.health;
  }

  /**
   * Инициализация объекта состояния
   * @private
   */
  initializeHealth() {
    this.health = {
      keywordsManager: 'unknown',
      channelsManager: 'unknown', 
      ui: 'unknown',
      overall: 'unknown'
    };
  }

  /**
   * Проверка отдельных модулей
   * @private
   */
  checkIndividualModules() {
    this.health.keywordsManager = this.checkModule(this.settingsMain.keywordsManager);
    this.health.channelsManager = this.checkModule(this.settingsMain.channelsManager);
    this.health.ui = this.checkModule(this.settingsMain.ui);
  }

  /**
   * Проверка состояния отдельного модуля
   * @private
   * @param {Object} module - Модуль для проверки
   * @returns {string} Состояние модуля
   */
  checkModule(module) {
    if (!module) {
      return 'missing';
    }
    
    // Дополнительные проверки для модулей
    if (typeof module.cleanup !== 'function') {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Вычисление общего состояния
   * @private
   */
  calculateOverallHealth() {
    const statuses = [
      this.health.keywordsManager,
      this.health.channelsManager,
      this.health.ui
    ];
    
    if (statuses.includes('missing')) {
      this.health.overall = 'critical';
    } else if (statuses.includes('degraded')) {
      this.health.overall = 'degraded';
    } else {
      this.health.overall = 'healthy';
    }
  }

  /**
   * Получить детальный отчет о состоянии
   * @returns {Object} Детальный отчет
   */
  getDetailedReport() {
    const basic = this.perform();
    
    return {
      ...basic,
      timestamp: new Date().toISOString(),
      recommendations: this.getRecommendations(),
      criticalIssues: this.getCriticalIssues()
    };
  }

  /**
   * Получить рекомендации по улучшению
   * @private
   * @returns {Array} Массив рекомендаций
   */
  getRecommendations() {
    const recommendations = [];
    
    if (this.health.keywordsManager === 'missing') {
      recommendations.push('Переинициализировать KeywordsManager');
    }
    
    if (this.health.channelsManager === 'missing') {
      recommendations.push('Переинициализировать ChannelsManager');
    }
    
    if (this.health.ui === 'missing') {
      recommendations.push('Переинициализировать SettingsUI');
    }
    
    if (this.health.overall === 'degraded') {
      recommendations.push('Выполнить полную переинициализацию');
    }
    
    return recommendations;
  }

  /**
   * Получить критические проблемы
   * @private
   * @returns {Array} Массив критических проблем
   */
  getCriticalIssues() {
    const issues = [];
    
    Object.entries(this.health).forEach(([module, status]) => {
      if (status === 'missing' && module !== 'overall') {
        issues.push(`${module} отсутствует`);
      }
    });
    
    return issues;
  }
}

/**
 * Фабричная функция для создания HealthChecker
 * @param {SettingsMain} settingsMain - Экземпляр SettingsMain
 * @returns {HealthChecker} Новый экземпляр HealthChecker
 */
export function createHealthChecker(settingsMain) {
  return new HealthChecker(settingsMain);
}

/**
 * Экспорт по умолчанию
 */
export default HealthChecker;