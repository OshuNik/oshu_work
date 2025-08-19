// theme-manager.js — универсальный менеджер тем для всех страниц
(function() {
  'use strict';

  const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

  // Инициализация темы при загрузке страницы
  function initTheme() {
    const savedTheme = localStorage.getItem('app-theme') || 'auto';
    const savedReduceAnimations = localStorage.getItem('reduce-animations') === 'true';
    const savedHighContrast = localStorage.getItem('high-contrast') === 'true';
    
    // Устанавливаем сохраненную тему
    setTheme(savedTheme);
    
    // Применяем дополнительные настройки
    if (savedReduceAnimations) {
      document.body.classList.add('reduce-animations');
    }
    
    if (savedHighContrast) {
      document.body.classList.add('high-contrast');
    }
    
    // Интеграция с Telegram WebApp Theme
    if (tg && tg.themeParams) {
      applyTelegramTheme(tg.themeParams);
    }
  }
  
  function setTheme(theme) {
    const body = document.body;
    
    // Удаляем все классы тем
    body.classList.remove('dark-theme');
    body.removeAttribute('data-theme');
    
    switch (theme) {
      case 'dark':
        body.setAttribute('data-theme', 'dark');
        break;
      case 'light':
        body.setAttribute('data-theme', 'light');
        break;
      case 'auto':
      default:
        // Авто-тема использует CSS @media (prefers-color-scheme)
        break;
    }
  }
  
  function applyTelegramTheme(themeParams) {
    if (!themeParams) return;
    
    const root = document.documentElement;
    
    // Применяем цвета из Telegram
    const colorMappings = {
      'bg_color': ['--tg-theme-bg-color', '--background-color'],
      'text_color': ['--tg-theme-text-color', '--text-color'],
      'hint_color': ['--tg-theme-hint-color', '--hint-color'],
      'link_color': ['--tg-theme-link-color', '--link-color'],
      'button_color': ['--tg-theme-button-color', '--button-bg'],
      'button_text_color': ['--tg-theme-button-text-color', '--button-text'],
      'secondary_bg_color': ['--tg-theme-secondary-bg-color', '--secondary-bg'],
      'header_bg_color': ['--tg-theme-header-bg-color', '--header-bg'],
      'destructive_text_color': ['--tg-theme-destructive-text-color', '--destructive-color'],
      'section_separator_color': ['--tg-theme-section-separator-color', '--section-separator']
    };
    
    Object.entries(colorMappings).forEach(([tgParam, cssVars]) => {
      if (themeParams[tgParam]) {
        cssVars.forEach(cssVar => {
          root.style.setProperty(cssVar, themeParams[tgParam]);
        });
      }
    });
  }
  
  // Слушаем изменения системной темы
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addListener(() => {
      const currentTheme = localStorage.getItem('app-theme');
      if (currentTheme === 'auto') {
        // Можно добавить уведомление о смене темы, если нужно
        console.log('Системная тема изменена');
      }
    });
  }
  
  // Экспортируем функции для использования в других скриптах
  window.ThemeManager = {
    initTheme,
    setTheme,
    applyTelegramTheme
  };
  
  // Автоматическая инициализация при загрузке DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
  } else {
    initTheme();
  }
})();
