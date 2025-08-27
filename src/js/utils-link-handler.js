// utils-link-handler.js — чистое решение для обработки ссылок без monkey patching

(function() {
  'use strict';

  const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

  // Функция для безопасного открытия ссылок в новой вкладке
  function openInNewTab(url) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Валидация ссылок
  function sanitizeLink(url) {
    if (typeof url !== 'string') return '';
    url = url.trim();
    if (!url) return '';
    
    const allowedProtocols = ['https:', 'http:', 'tg:', 'mailto:'];
    
    try {
      if (url.startsWith('tg://')) {
        return url;
      }
      
      const urlObj = new URL(url);
      
      if (!allowedProtocols.includes(urlObj.protocol)) {
        return '';
      }
      
      return url;
    } catch (e) {
      return '';
    }
  }

  // Определение платформы
  function detectPlatform() {
    const isInTelegramApp = !!(tg && tg.platform !== 'unknown');
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isDesktop = !isMobile;
    
    return { isInTelegramApp, isMobile, isDesktop };
  }

  // Основная функция обработки ссылок
  function handleLink(url) {
    let safeUrl = sanitizeLink(url);
    if (!safeUrl) return;

    // Исправляем telegram ссылки
    if (safeUrl.startsWith('tg://') && !safeUrl.includes('?')) {
      const username = safeUrl.replace('tg://', '').replace('/', '');
      safeUrl = `https://t.me/${username}`;
    }

    const { isInTelegramApp, isDesktop } = detectPlatform();
    
    // ПРАВИЛЬНАЯ ЛОГИКА:
    // 1. ПК - ВСЕГДА новое окно (_blank)
    // 2. Телефон в Telegram Mini App - через TG API
    // 3. Телефон в браузере - новое окно
    
    if (isDesktop) {
      // ПК: всегда открываем в новой вкладке
      openInNewTab(safeUrl);
    } else if (isInTelegramApp) {
      // Мобильный Telegram Mini App
      if (safeUrl.startsWith('https://t.me')) {
        // Telegram ссылки через TG API
        if (typeof tg.openTelegramLink === 'function') {
          tg.openTelegramLink(safeUrl);
        } else {
          openInNewTab(safeUrl);
        }
      } else {
        // Внешние ссылки через TG API (откроется в браузере/внутри TG)
        if (typeof tg.openLink === 'function') {
          tg.openLink(safeUrl);
        } else {
          openInNewTab(safeUrl);
        }
      }
    } else {
      // Мобильный браузер: новое окно
      openInNewTab(safeUrl);
    }
    
    // НЕ вызываем appController.destroy()!
    // Приложение должно продолжать работать
  }

  // Экспорт через глобальный объект utils
  if (!window.utils) {
    window.utils = {};
  }
  
  // Заменяем функцию openLink на исправленную версию
  window.utils.openLink = handleLink;
  window.utils.sanitizeLink = sanitizeLink;
  
  // Для совместимости - также доступно как LinkHandler
  window.LinkHandler = {
    openLink: handleLink,
    sanitizeLink: sanitizeLink,
    openInNewTab: openInNewTab
  };
})();