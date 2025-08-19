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
        // Принудительно применяем темную тему
        applyDarkTheme();
        break;
      case 'light':
        body.setAttribute('data-theme', 'light');
        // Принудительно применяем светлую тему
        applyLightTheme();
        break;
      case 'auto':
      default:
        // Авто-тема использует CSS @media (prefers-color-scheme)
        // Убираем принудительные стили
        removeForcedTheme();
        break;
    }
  }
  
  // Принудительное применение темной темы
  function applyDarkTheme() {
    const root = document.documentElement;
    const darkColors = {
      '--background-color': '#0F0F0F',
      '--card-color': '#1E1E1E',
      '--text-color': '#F5F5F5',
      '--hint-color': '#A0A0A0',
      '--border-color': '#3A3A3A',
      '--input-bg': '#2A2A2A',
      '--input-border': '#4A4A4A',
      '--secondary-bg': '#161616',
      '--header-bg': '#1E1E1E',
      '--button-bg': '#2D2D2D',
      '--button-text': '#F5F5F5',
      '--destructive-color': '#FF6B6B',
      '--link-color': '#64B5F6',
      '--section-separator': '#2A2A2A',
      '--accent-red': '#FF6B6B',
      '--accent-yellow': '#FFD54F',
      '--accent-green': '#81C784',
      '--accent-blue': '#64B5F6',
      '--box-shadow': '4px 4px 0px rgba(0, 0, 0, 0.4)',
      '--box-shadow-pressed': '2px 2px 0px rgba(0, 0, 0, 0.4)'
    };
    
    Object.entries(darkColors).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
  }
  
  // Принудительное применение светлой темы
  function applyLightTheme() {
    const root = document.documentElement;
    const lightColors = {
      '--background-color': '#F0F0F0',
      '--card-color': '#FFFFFF',
      '--text-color': '#000000',
      '--hint-color': '#666666',
      '--border-color': '#000000',
      '--input-bg': '#FFFFFF',
      '--input-border': '#CCCCCC',
      '--secondary-bg': '#E8E8E8',
      '--header-bg': '#FFFFFF',
      '--button-bg': '#FFFFFF',
      '--button-text': '#000000',
      '--destructive-color': '#FF5C5C',
      '--link-color': '#41A6FF',
      '--section-separator': '#E0E0E0',
      '--accent-red': '#FF5C5C',
      '--accent-yellow': '#FFD93D',
      '--accent-green': '#6BCB77',
      '--accent-blue': '#41A6FF',
      '--box-shadow': '4px 4px 0px #000000',
      '--box-shadow-pressed': '2px 2px 0px #000000'
    };
    
    Object.entries(lightColors).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
  }
  
  // Убираем принудительные стили для авто-темы
  function removeForcedTheme() {
    const root = document.documentElement;
    const allColorProperties = [
      '--background-color', '--card-color', '--text-color', '--hint-color',
      '--border-color', '--input-bg', '--input-border', '--secondary-bg',
      '--header-bg', '--button-bg', '--button-text', '--destructive-color',
      '--link-color', '--section-separator', '--accent-red', '--accent-yellow',
      '--accent-green', '--accent-blue', '--box-shadow', '--box-shadow-pressed'
    ];
    
    allColorProperties.forEach(property => {
      root.style.removeProperty(property);
    });
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
