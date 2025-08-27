// env-dev.js — переменные для development режима
// Этот файл используется только локально для тестирования

(function() {
  'use strict';
  
  // Проверяем что мы в development режиме или на GitHub Pages
  const isLocalhost = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname === '';
  const isGitHubPages = window.location.hostname.includes('github.io');
  
  if (isLocalhost || isGitHubPages) {
    // Устанавливаем development переменные
    window.ENV = {
      VITE_SUPABASE_URL: 'https://lwfhtwnfqmdjwzrdznvv.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3Zmh0d25mcW1kand6cmR6bnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNDU0OTksImV4cCI6MjA2OTkyMTQ5OX0.3bvJyJ1NFn8V-bpKxApRIWB4k2_TWNbEYv-ytwhbJUE',
      VITE_APP_ENVIRONMENT: 'development'
    };
    
    // Debug logs removed for production
  }
})();