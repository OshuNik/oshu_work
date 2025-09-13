// env-config.js — загрузка переменных окружения

(function() {
  'use strict';

  // Функция для безопасного получения переменных окружения
  function getEnvVar(key, fallback = '') {
    // Переменные из window.ENV (инжектируются в production)
    if (window.ENV && window.ENV[key]) {
      return window.ENV[key];
    }
    
    // Проверяем глобальные переменные (для dev режима)
    if (window[key]) {
      return window[key];
    }
    
    return fallback;
  }

  // Проверить наличие всех обязательных переменных
  function validateRequiredVars(vars) {
    const missing = [];
    
    for (const [key, value] of Object.entries(vars)) {
      if (!value || value.trim() === '') {
        missing.push(key);
      }
    }
    
    if (missing.length > 0) {
      console.warn('⚠️ Отсутствуют переменные окружения:', missing.join(', '));
      console.warn('📖 Проверьте файл .env или window.ENV');
      return false;
    }
    
    return true;
  }

  // Функция для определения окружения
  function getEnvironment() {
    const env = getEnvVar('VITE_APP_ENVIRONMENT', 'development');
    const isGitHubPages = window.location.hostname.includes('github.io');
    const isLocalhost = window.location.hostname === 'localhost';
    
    if (isGitHubPages) return 'production';
    if (isLocalhost) return 'development';
    return env;
  }

  // Экспорт функций в глобальную область
  window.ENV_CONFIG = {
    getEnvVar,
    validateRequiredVars,
    getEnvironment,
    
    // Shorthand для часто используемых переменных
    get supabaseUrl() {
      const value = getEnvVar('VITE_SUPABASE_URL');
      console.log('🔍 ENV_CONFIG.supabaseUrl:', value);
      return value;
    },
    
    get supabaseAnonKey() {
      const value = getEnvVar('VITE_SUPABASE_ANON_KEY');
      console.log('🔍 ENV_CONFIG.supabaseAnonKey:', value);
      return value;
    },
    
    get isProduction() {
      return getEnvironment() === 'production';
    },
    
    get isDevelopment() {
      return getEnvironment() === 'development';
    }
  };

})();