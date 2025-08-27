// theme-manager.js — универсальный менеджер тем для всех страниц
(function() {
  'use strict';

  const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

  // Инициализация темы при загрузке страницы
  function initTheme() {
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    const savedReduceAnimations = localStorage.getItem('reduce-animations') === 'true';
    const savedHighContrast = localStorage.getItem('high-contrast') === 'true';
    
    // Устанавливаем сохраненную тему без уведомления
    setTheme(savedTheme, false);
    
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
    const root = document.documentElement;
    
    // Удаляем все классы тем
    body.classList.remove('dark-theme');
    body.removeAttribute('data-theme');
    root.removeAttribute('data-theme');
    
    switch (theme) {
      case 'dark':
        body.setAttribute('data-theme', 'dark');
        root.setAttribute('data-theme', 'dark');
        // Принудительно применяем темную тему
        applyDarkTheme();
        break;
      case 'light':
      default:
        body.setAttribute('data-theme', 'light');
        root.setAttribute('data-theme', 'light');
        // Принудительно применяем светлую тему
        applyLightTheme();
        break;
    }
    
    // Сохраняем выбранную тему
    localStorage.setItem('app-theme', theme);
  }
  
  // Принудительное применение темной темы - улучшенные цвета Material Design 2024
  function applyDarkTheme() {
    const root = document.documentElement;
    const darkColors = {
      '--background-color': '#121212',     /* Material Design рекомендация */
      '--card-color': '#1E1E1E',           /* Достаточный контраст 15.8:1+ */
      '--text-color': '#E8E8E8',           /* Не яркий белый - мягче для глаз */
      '--hint-color': '#A0A0A0',           /* Серый с достаточным контрастом */
      '--border-color': '#333333',         /* Более видимые границы */
      '--input-bg': '#2C2C2C',             /* Поля ввода с хорошим контрастом */
      '--input-border': '#404040',         /* Видимые границы полей */
      '--secondary-bg': '#1A1A1A',         /* Вторичный фон темнее основного */
      '--header-bg': '#1E1E1E',            /* Фон заголовка как карточки */
      '--button-bg': '#2D2D2D',            /* Кнопки с хорошим контрастом */
      '--button-text': '#E8E8E8',          /* Текст кнопок */
      '--destructive-color': '#F48FB1',    /* Менее агрессивный красный */
      '--link-color': '#82B1FF',           /* Более мягкий синий для ссылок */
      '--section-separator': '#2A2A2A',    /* Разделители */
      '--accent-red': '#EF5350',           /* Десатурированный красный (-20% saturation) */
      '--accent-yellow': '#FFCA28',        /* Десатурированный желтый (-20% saturation) */
      '--accent-green': '#66BB6A',         /* Десатурированный зеленый (-20% saturation) */
      '--accent-blue': '#42A5F5',          /* Десатурированный синий (-20% saturation) */
      '--box-shadow': '4px 4px 0px rgba(0, 0, 0, 0.5)',        /* Мягкие тени */
      '--box-shadow-pressed': '2px 2px 0px rgba(0, 0, 0, 0.5)' /* Мягкие тени */
    };
    
    Object.entries(darkColors).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
  }
  
  // Принудительное применение светлой темы - сброс всех темных переменных
  function applyLightTheme() {
    const root = document.documentElement;
    
    // Сначала удаляем все темные переменные
    const darkVariables = [
      '--background-color',
      '--card-color',
      '--text-color',
      '--hint-color',
      '--border-color',
      '--input-bg',
      '--input-border',
      '--secondary-bg',
      '--header-bg',
      '--button-bg',
      '--button-text',
      '--destructive-color',
      '--link-color',
      '--section-separator',
      '--accent-red',
      '--accent-yellow',
      '--accent-green',
      '--accent-blue',
      '--box-shadow',
      '--box-shadow-pressed'
    ];
    
    // Удаляем все темные переменные для возврата к исходным значениям CSS
    darkVariables.forEach(property => {
      root.style.removeProperty(property);
    });
    
    // Теперь устанавливаем светлые значения (если нужны кастомные)
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
      '--accent-red': '#FF5C5C',           /* Оригинальный красный */
      '--accent-yellow': '#FFD93D',        /* Оригинальный желтый */
      '--accent-green': '#6BCB77',         /* Оригинальный зеленый */
      '--accent-blue': '#41A6FF',          /* Оригинальный синий */
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
  
  // Автоматическая инициализация при загрузке DOM (БЕЗ дублирования)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
  } else {
    initTheme();
  }
  
  // Также применяем при полной загрузке страницы
  window.addEventListener('load', () => {
    // Убираем критический CSS после загрузки JavaScript
    const criticalStyles = document.querySelectorAll('style');
    criticalStyles.forEach(style => {
      if (style.textContent.includes('!important')) {
        style.remove();
      }
    });
  });
})();
