// config.js — единая точка конфигурации для всех окружений (ES модуль)

// Определение окружения
const isLocalhost = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' ||
                   window.location.hostname === '';
const isGitHubPages = window.location.hostname.includes('github.io');
const isDevelopment = isLocalhost; // GitHub Pages это production!

// Centralized Environment Configuration
const ENVIRONMENTS = {
  development: {
    SUPABASE_URL: 'https://lwfhtwnfqmdjwzrdznvv.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3Zmh0d25mcW1kand6cmR6bnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNDU0OTksImV4cCI6MjA2OTkyMTQ5OX0.3bvJyJ1NFn8V-bpKxApRIWB4k2_TWNbEYv-ytwhbJUE'
  },
  production: {
    SUPABASE_URL: window.ENV?.SUPABASE_URL || 'https://lwfhtwnfqmdjwzrdznvv.supabase.co',
    SUPABASE_ANON_KEY: window.ENV?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3Zmh0d25mcW1kand6cmR6bnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNDU0OTksImV4cCI6MjA2OTkyMTQ5OX0.3bvJyJ1NFn8V-bpKxApRIWB4k2_TWNbEYv-ytwhbJUE'
  }
};

// Выбор конфигурации на основе окружения
const currentEnv = isDevelopment ? 'development' : 'production';
const envConfig = ENVIRONMENTS[currentEnv];

// Основная конфигурация приложения
window.APP_CONFIG = {
  // Supabase конфигурация
  SUPABASE_URL: envConfig.SUPABASE_URL,
  SUPABASE_ANON_KEY: envConfig.SUPABASE_ANON_KEY,
  
  // Error Monitor конфигурация
  ERROR_BOT_TOKEN: window.ENV?.ERROR_BOT_TOKEN || '8356223189:AAEuNYcDDz-CyzICtf2L2MJM8KL9OIzQm1A',
  ERROR_CHAT_ID: window.ENV?.ERROR_CHAT_ID || '1521478462',
  ERROR_MONITOR_ENABLED: currentEnv === 'production', // Только в production (тестирование завершено)
  
  // Параметры приложения
  PAGE_SIZE_MAIN: 10,
  RETRY_OPTIONS: { retries: 2, backoffMs: 400 },
  
  PTR_CONFIG: {
    THRESHOLD: 80,
    BAR_HEIGHT: 60
  },
  
  SEARCH_FIELDS: ['reason', 'text_highlighted', 'industry', 'company_name'],
  
  STATUSES: {
    NEW: 'new',
    FAVORITE: 'favorite',
    DELETED: 'deleted',
  },
  CATEGORIES: {
    MAIN: 'ТОЧНО ТВОЁ',
    MAYBE: 'МОЖЕТ БЫТЬ',
  },
  
  // Метаинформация
  ENVIRONMENT: currentEnv,
  IS_DEVELOPMENT: isDevelopment
};

// Backward compatibility с window.ENV (если используется где-то еще)
if (isDevelopment) {
  window.ENV = {
    VITE_SUPABASE_URL: envConfig.SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: envConfig.SUPABASE_ANON_KEY,
    VITE_APP_ENVIRONMENT: 'development'
  };
}