// config.js — все настраиваемые параметры в одном месте

window.APP_CONFIG = {
  // 👉 Supabase конфигурация (используем переменные окружения если доступны)
  SUPABASE_URL: window.SUPABASE_URL || 'https://lwfhtwnfqmdjwzrdznvv.supabase.co',
  SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3Zmh0d25mcW1kand6cmR6bnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNDU0OTksImV4cCI6MjA2OTkyMTQ5OX0.3bvJyJ1NFn8V-bpKxApRIWB4k2_TWNbEYv-ytwhbJUE',

  // Порции на главной
  PAGE_SIZE_MAIN: 10,

  // Ретраи сетевых запросов
  RETRY_OPTIONS: { retries: 2, backoffMs: 400 },
  
  // ИЗМЕНЕНИЕ: Параметры для Pull-to-Refresh
  PTR_CONFIG: {
    THRESHOLD: 80, // (в px) дистанция для срабатывания
    BAR_HEIGHT: 60 // (в px) высота плашки обновления
  },

  // Поля, по которым ищем на сервере (ilike)
  SEARCH_FIELDS: ['reason', 'text_highlighted', 'industry', 'company_name'],

  STATUSES: {
    NEW: 'new',
    FAVORITE: 'favorite',
    DELETED: 'deleted',
  },
  CATEGORIES: {
    MAIN: 'ТОЧНО ТВОЁ',
    MAYBE: 'МОЖЕТ БЫТЬ',
  }
};
