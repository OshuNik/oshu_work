// utils.js — общие утилиты (с новой функцией Pull-to-Refresh)

(function () {
  'use strict';

  const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
  const CFG = window.APP_CONFIG || {};

  function uiToast(message = '', options = {}) {
    const { onUndo, onTimeout, timeout = 3000 } = options;
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        console.error('Toast container not found');
        return;
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    const textEl = document.createElement('span');
    textEl.textContent = message;
    toast.appendChild(textEl);
    let actionTimeout;
    const removeToast = () => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        }, 300);
    };
    if (typeof onUndo === 'function') {
      const undoBtn = document.createElement('button');
      undoBtn.className = 'toast-undo-btn';
      undoBtn.textContent = 'Отменить';
      undoBtn.onclick = (e) => {
        e.stopPropagation();
        clearTimeout(actionTimeout);
        onUndo();
        removeToast();
      };
      toast.appendChild(undoBtn);
    }
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    actionTimeout = setTimeout(() => {
        removeToast();
        if (onTimeout) {
            onTimeout();
        }
    }, timeout);
  }

  const safeAlert = (msg) => {
    if (tg && typeof tg.showAlert === 'function') tg.showAlert(String(msg));
    else uiToast(String(msg));
  };
  
  function showCustomConfirm(message) {
    return new Promise(resolve => {
        const confirmOverlay = document.querySelector('#custom-confirm-overlay');
        if (!confirmOverlay) return resolve(window.confirm(message));
        const confirmText = confirmOverlay.querySelector('#custom-confirm-text');
        const confirmOkBtn = confirmOverlay.querySelector('#confirm-btn-ok');
        const confirmCancelBtn = confirmOverlay.querySelector('#confirm-btn-cancel');
        if (!confirmText || !confirmOkBtn || !confirmCancelBtn) {
            return resolve(window.confirm(message));
        }
        confirmText.textContent = message;
        confirmOverlay.classList.remove('hidden');
        const close = (result) => {
            confirmOverlay.classList.add('hidden');
            confirmOkBtn.onclick = null;
            confirmCancelBtn.onclick = null;
            resolve(result);
        };
        confirmOkBtn.onclick = () => close(true);
        confirmCancelBtn.onclick = () => close(false);
    });
  }
  
  function createSupabaseHeaders(options = {}) {
    const { prefer } = options;
    const headers = {
      'apikey': CFG.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${CFG.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };
    if (prefer) {
      headers['Prefer'] = prefer;
    }
    return headers;
  }

  const escapeHtml = (s = '') =>
    String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const stripTags = (html = '') => {
    if (!html) return '';
    
    // Создаем временный div
    const tmp = document.createElement('div');
    
    // Безопасно добавляем только текстовый контент
    // Это предотвращает выполнение любых скриптов
    tmp.textContent = html;
    
    // Если нужно обработать HTML теги, используем textContent для извлечения
    // чистого текста без выполнения потенциально опасного кода
    return tmp.textContent || '';
  };

  const debounce = (fn, delay = 250) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  };

  const highlightText = (text = '', q = '') => {
    if (!q) return escapeHtml(text);
    const rx = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escapeHtml(text).replace(rx, '<mark class="highlight">$1</mark>');
  };

  // Безопасная функция для вставки подсвеченного текста без XSS
  const setHighlightedText = (element, text, query) => {
    if (!query) {
      element.textContent = text;
      return;
    }
    
    // Очищаем элемент
    element.textContent = '';
    
    const rx = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(rx);
    
    parts.forEach((part, i) => {
      if (i % 2 === 1) {
        // Это совпадение - создаем mark элемент
        const mark = document.createElement('mark');
        mark.className = 'highlight';
        mark.textContent = part;
        element.appendChild(mark);
      } else {
        // Это обычный текст
        if (part) {
          element.appendChild(document.createTextNode(part));
        }
      }
    });
  };

  function sanitizeLink(raw = '') {
    let s = String(raw).trim();
    if (!s) return '';
    
    // Белый список разрешенных протоколов
    const ALLOWED_PROTOCOLS = ['https:', 'http:', 'tg:'];
    
    // Белый список разрешенных доменов для Telegram
    const ALLOWED_DOMAINS = [
      't.me',
      'telegram.me',
      'telegram.org'
    ];
    
    // Преобразуем Telegram ссылки в HTTPS
    if (/^(t\.me|telegram\.me)\//i.test(s)) {
        s = 'https://' + s;
    }
    
    // Добавляем https:// для доменов без протокола
    if (!/^[a-z]+:\/\//i.test(s) && s.includes('.')) {
        s = 'https://' + s;
    }
    
    try {
        const url = new URL(s);
        
        // Проверяем протокол
        if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
            return '';
        }
        
        // Дополнительная проверка для Telegram доменов
        if (url.protocol === 'https:' && url.hostname) {
          const hostname = url.hostname.toLowerCase();
          // Разрешаем только безопасные домены или Telegram домены
          if (hostname.startsWith('t.me') || hostname.startsWith('telegram.me') || 
              ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain))) {
            return url.href;
          }
          
          // Для других HTTPS доменов делаем базовую проверку
          if (hostname.match(/^[a-z0-9.-]+\.[a-z]{2,}$/i)) {
            return url.href;
          }
        }
        
        // Для tg: протокола разрешаем только базовые паттерны
        if (url.protocol === 'tg:') {
            return url.href;
        }
        
        // Для http протокола - более строгая проверка
        if (url.protocol === 'http:' && url.hostname && 
            url.hostname.match(/^[a-z0-9.-]+\.[a-z]{2,}$/i)) {
            return url.href;
        }
        
    } catch (e) {
        // Невалидный URL
    }
    return '';
  }
  
  function openLink(url) {
    let safeUrl = sanitizeLink(url);
    if (!safeUrl) return;

    if (safeUrl.startsWith('tg://') && !safeUrl.includes('?')) {
        const username = safeUrl.replace('tg://', '').replace('/', '');
        safeUrl = `https://t.me/${username}`;
    }

    if (safeUrl.startsWith('https://t.me')) {
        if (tg && typeof tg.openTelegramLink === 'function') {
            tg.openTelegramLink(safeUrl);
        } else {
            window.open(safeUrl, '_blank', 'noopener');
        }
    } else {
        if (tg && typeof tg.openLink === 'function') {
            tg.openLink(safeUrl);
        } else {
            window.open(safeUrl, '_blank', 'noopener');
        }
    }
  }

  function formatSmartTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now - d;
    const sec = Math.floor(diffMs / 1000);
    const min = Math.floor(sec / 60);
    const pad = n => n.toString().padStart(2, '0');
    const months = ['янв','фев','мар','апр','мая','июн','юл','авг','сен','окт','ноя','дек'];
    const isSameDay = now.toDateString() === d.toDateString();
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    const isYesterday = yest.toDateString() === d.toDateString();
    if (sec < 30) return 'только что';
    if (min < 60 && min >= 1) return `${min} мин назад`;
    if (isSameDay) return `сегодня, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (isYesterday) return `вчера, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `${d.getDate().toString().padStart(2,'0')} ${months[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const formatTimestamp = (s) => formatSmartTime(s);

  function parseTotal(resp){
    const cr = resp.headers.get('content-range');
    if (!cr || !cr.includes('/')) return 0;
    const total = cr.split('/').pop();
    return Number(total) || 0;
  }
  
  const containsImageMarker = (text = '') =>
    /(\[\s*изображени[ея]\s*\]|\b(изображени[ея]|фото|картинк\w|скрин)\b)/i.test(text);
  const cleanImageMarkers = (text = '') => String(text).replace(/\[\s*изображени[ея]\s*\]/gi, '').replace(/\s{2,}/g, ' ').trim();
  function pickImageUrl(v, detailsText = '') {
    const msg = sanitizeLink(v.message_link || '');
    const img = sanitizeLink(v.image_link || '');
    const allow = (v.has_image === true) || containsImageMarker(detailsText) || containsImageMarker(v.reason || '');
    if (!allow) return '';
    if (msg) return msg;
    if (img) return img;
    return '';
  }

  async function fetchWithRetry(url, options = {}, retryCfg = { retries: 0, backoffMs: 300 }) {
    let attempt = 0;
    let lastErr = null;
    
    // Валидация входных параметров
    if (!url || typeof url !== 'string') {
      throw new Error('fetchWithRetry: некорректный URL');
    }
    
    const maxRetries = Math.max(0, Math.min(5, retryCfg.retries || 0)); // Ограничиваем ретраи
    const backoffMs = Math.max(100, Math.min(5000, retryCfg.backoffMs || 300)); // Ограничиваем задержку
    
    while (attempt <= maxRetries) {
      try {
        const response = await fetch(url, options);
        
        // Проверяем статус ответа
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
          error.status = response.status;
          error.response = response;
          
          // Для некоторых статусов не делаем ретрай
          if (response.status === 400 || response.status === 401 || 
              response.status === 403 || response.status === 404) {
            throw error;
          }
          
          // Для серверных ошибок делаем ретрай
          if (response.status >= 500 && attempt < maxRetries) {
            lastErr = error;
            throw error;
          }
          
          throw error;
        }
        
        return response;
      } catch (e) {
        lastErr = e;
        
        // Логируем попытки (только в development)
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`fetchWithRetry попытка ${attempt + 1}/${maxRetries + 1} неудачна:`, e.message);
        }
        
        // Последняя попытка - кидаем ошибку
        if (attempt === maxRetries) {
          break;
        }
        
        // Определяем, стоит ли делать ретрай
        const shouldRetry = 
          e.name === 'TypeError' || // Сетевые ошибки
          e.name === 'AbortError' || // Timeout
          (e.status && e.status >= 500); // Серверные ошибки
          
        if (!shouldRetry) {
          break;
        }
        
        // Экспоненциальная задержка с джиттером
        const delay = backoffMs * Math.pow(2, attempt) + Math.random() * 100;
        await new Promise(r => setTimeout(r, delay));
        attempt++;
      }
    }
    
    // Создаем более информативную ошибку
    const finalError = lastErr || new Error('Network error');
    if (lastErr && lastErr.status) {
      finalError.message = `Запрос не удался после ${maxRetries + 1} попыток. Последняя ошибка: HTTP ${lastErr.status}`;
    } else {
      finalError.message = `Сетевая ошибка после ${maxRetries + 1} попыток: ${lastErr?.message || 'Неизвестная ошибка'}`;
    }
    
    throw finalError;
  }

  function renderEmptyState(container, message) {
    if (!container) {
      console.error('renderEmptyState: контейнер не найден');
      return;
    }
    
    // Создаём элементы безопасно через DOM API
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';
    
    const img = document.createElement('img');
    img.className = 'empty-state-gif';
    img.alt = 'Загрузка изображения';
    img.src = 'https://raw.githubusercontent.com/OshuNik/oshu_vacancies/5325db67878d324810971a262d689ea2ec7ac00f/img/Uploading%20a%20vacancy.%20The%20doggie.gif';
    
    const p = document.createElement('p');
    p.className = 'empty-state-text';
    p.textContent = message; // безопасно вставляем текст
    
    emptyDiv.appendChild(img);
    emptyDiv.appendChild(p);
    container.innerHTML = ''; // очищаем
    container.appendChild(emptyDiv);
  }

  function renderError(container, message, onRetry) {
    if (!container) {
      console.error('renderError: контейнер не найден');
      return;
    }
    
    // Создаём элементы безопасно
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';
    
    const p = document.createElement('p');
    p.className = 'empty-state-text';
    p.textContent = `Ошибка: ${message || 'Ошибка сети'}`;
    
    const wrapDiv = document.createElement('div');
    wrapDiv.className = 'load-more-wrap';
    
    const btn = document.createElement('button');
    btn.className = 'load-more-btn';
    btn.textContent = 'Повторить';
    const retryHandler = () => {
      if (typeof onRetry === 'function') {
        onRetry();
      }
    };
    btn.addEventListener('click', retryHandler);
    
    // Сохраняем cleanup функцию
    container.retryCleanup = () => {
      btn.removeEventListener('click', retryHandler);
    };
    
    wrapDiv.appendChild(btn);
    emptyDiv.appendChild(p);
    emptyDiv.appendChild(wrapDiv);
    
    container.innerHTML = '';
    container.appendChild(emptyDiv);
  }

  function ensureLoadMore(container, onClick) {
    let wrap = container.querySelector('.load-more-wrap');
    let btn = container.querySelector('.load-more-btn');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'load-more-wrap';
      btn = document.createElement('button');
      btn.className = 'load-more-btn';
      btn.type = 'button';
      btn.textContent = 'Загрузить ещё';
      wrap.appendChild(btn);
      container.appendChild(wrap);
    }
    btn.onclick = onClick;
    return { wrap, btn };
  }
  
  function updateLoadMore(container, visible) {
    let wrap = container.querySelector('.load-more-wrap');
    if (!wrap) return;
    wrap.style.display = visible ? '' : 'none';
  }

  function createVacancyCard(v, options = {}) {
    const { pageType = 'main', searchQuery = '' } = options;
    const template = document.getElementById('vacancy-card-template');
    if (!template) {
        console.error('Template #vacancy-card-template not found!');
        const el = document.createElement('div');
        el.textContent = 'Ошибка: шаблон не найден.';
        return el;
    }
    
    const card = template.content.cloneNode(true).querySelector('.vacancy-card');
    if (!card) {
        console.error('Could not find .vacancy-card in template');
        const el = document.createElement('div');
        el.textContent = 'Ошибка: структура шаблона неверна.';
        return el;
    }

    card.id = `card-${v.id}`;
    if (v.category === CFG.CATEGORIES.MAIN) card.classList.add('category-main');
    else if (v.category === CFG.CATEGORIES.MAYBE) card.classList.add('category-maybe');
    else card.classList.add('category-other');
    const elements = {
      applyBtn: card.querySelector('[data-element="apply-btn"]'),
      favoriteBtn: card.querySelector('[data-element="favorite-btn"]'),
      deleteBtn: card.querySelector('[data-element="delete-btn"]'),
      category: card.querySelector('[data-element="category"]'),
      summary: card.querySelector('[data-element="summary"]'),
      infoWindow: card.querySelector('[data-element="info-window"]'),
      details: card.querySelector('[data-element="details"]'),
      attachments: card.querySelector('[data-element="attachments"]'),
      fullText: card.querySelector('[data-element="full-text"]'),
      skills: card.querySelector('[data-element="skills"]'),
      channel: card.querySelector('[data-element="channel"]'),
      timestamp: card.querySelector('[data-element="timestamp"]'),
      metaSeparator: card.querySelector('.meta-separator'),
    };
    const applyUrl = sanitizeLink(v.apply_url || '');
    if (applyUrl) {
      elements.applyBtn.dataset.action = 'apply';
      elements.applyBtn.dataset.url = applyUrl;
    } else {
      elements.applyBtn.remove();
    }
    if (pageType === 'main') {
      elements.favoriteBtn.dataset.action = 'favorite';
      elements.favoriteBtn.dataset.id = v.id;
    } else {
      elements.favoriteBtn.remove();
    }
    elements.deleteBtn.dataset.action = 'delete';
    elements.deleteBtn.dataset.id = v.id;
    elements.category.textContent = v.category || 'NO_CATEGORY';
    const summaryText = v.reason || 'Описание не было сгенерировано.';
    elements.summary.dataset.originalSummary = summaryText;
    setHighlightedText(elements.summary, summaryText, searchQuery);
    const infoRows = [];
    const cleanVal = val => String(val ?? '').replace(/[«»"“”'‘’`']/g,'').trim();
    const isMeaningful = val => !!cleanVal(val) && !['не указано', 'n/a'].includes(cleanVal(val).toLowerCase());
    const fmt = [v.employment_type, v.work_format].map(cleanVal).filter(isMeaningful).join(' / ');
    if (fmt) infoRows.push({ label: 'ФОРМАТ', value: fmt, type: 'default' });
    if (isMeaningful(v.salary_display_text)) infoRows.push({ label: 'ОПЛАТА', value: cleanVal(v.salary_display_text), type: 'salary' });
    if (isMeaningful(v.industry)) infoRows.push({ label: 'СФЕРА', value: cleanVal(v.industry), type: 'industry' });
    if (infoRows.length > 0) {
      infoRows.forEach(r => {
        const row = document.createElement('div');
        row.className = `info-row info-row--${r.type}`;
        row.innerHTML = `<div class="info-label">${escapeHtml(r.label)} >></div><div class="info-value">${escapeHtml(r.value)}</div>`;
        elements.infoWindow.appendChild(row);
      });
    } else {
      elements.infoWindow.remove();
    }
    const originalDetailsHtml = String(v.text_highlighted || '').replace(/\[\s*Изображение\s*\]\s*/gi, '');
    const bestImageUrl = pickImageUrl(v, originalDetailsHtml);
    if (bestImageUrl) {
        const imgBtn = document.createElement('a');
        imgBtn.className = 'image-link-button';
        imgBtn.href = bestImageUrl;
        imgBtn.target = '_blank';
        imgBtn.rel = 'noopener noreferrer';
        imgBtn.textContent = 'Изображение';
        elements.attachments.appendChild(imgBtn);
    }
    if (originalDetailsHtml) {
        // Безопасная обработка: разрешаем только базовые теги форматирования
        const allowedTags = /<\/?(?:br|p|strong|b|em|i|u|span|div)(?:\s[^>]*)?>|&[a-zA-Z0-9#]+;/gi;
        const safeHtml = originalDetailsHtml
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Удаляем script теги
            .replace(/on\w+\s*=\s*"[^"]*"/gi, '') // Удаляем event handlers (onclick, onload и т.д.)
            .replace(/javascript:/gi, '') // Удаляем javascript: ссылки
            .replace(/data:/gi, '') // Удаляем data: ссылки
            .replace(/<iframe\b[^>]*>/gi, '') // Удаляем iframe
            .replace(/<object\b[^>]*>/gi, '') // Удаляем object
            .replace(/<embed\b[^>]*>/gi, ''); // Удаляем embed
        elements.fullText.innerHTML = safeHtml;
    }
    if (!bestImageUrl && !originalDetailsHtml) {
        elements.details.remove();
    }
    if (Array.isArray(v.skills) && v.skills.length > 0) {
        v.skills.slice(0, 3).forEach(s => {
            const tag = document.createElement('span');
            tag.className = 'footer-skill-tag';
            tag.textContent = s;
            elements.skills.appendChild(tag);
        });
    } else {
      elements.skills.remove();
    }
    if(v.channel) {
      elements.channel.textContent = v.channel;
    } else {
      elements.channel.remove();
      elements.metaSeparator.remove();
    }
    elements.timestamp.textContent = formatTimestamp(v.timestamp);
    const searchChunks = [
      v.category, v.reason, v.industry, v.company_name,
      Array.isArray(v.skills) ? v.skills.join(' ') : '',
      stripTags(originalDetailsHtml)
    ].filter(Boolean);
    card.dataset.searchText = searchChunks.join(' ').toLowerCase();
    return card;
  }
  
  /**
   * НОВАЯ ВЕРСИЯ PULL-TO-REFRESH
   */
     /**
   * CLIENT-SIDE RATE LIMITER
   * Защита от злоупотреблений API на основе Token Bucket алгоритма
   */
  class RateLimiter {
    constructor(options = {}) {
      this.tokensPerInterval = options.tokensPerInterval || 1;
      this.interval = this.parseInterval(options.interval || 1000);
      this.bucketSize = options.bucketSize || this.tokensPerInterval;
      this.tokens = this.bucketSize;
      this.lastRefill = Date.now();
      this.fireImmediately = options.fireImmediately || false;
    }

    parseInterval(interval) {
      if (typeof interval === 'number') return interval;
      if (typeof interval === 'string') {
        switch (interval.toLowerCase()) {
          case 'second': return 1000;
          case 'minute': return 60 * 1000;
          case 'hour': return 60 * 60 * 1000;
          case 'day': return 24 * 60 * 60 * 1000;
          default: return parseInt(interval) || 1000;
        }
      }
      return 1000;
    }

    refillTokens() {
      const now = Date.now();
      const timePassed = now - this.lastRefill;
      const tokensToAdd = Math.floor(timePassed / this.interval * this.tokensPerInterval);
      
      if (tokensToAdd > 0) {
        this.tokens = Math.min(this.bucketSize, this.tokens + tokensToAdd);
        this.lastRefill = now;
      }
    }

    async removeTokens(count = 1) {
      this.refillTokens();
      
      if (this.fireImmediately) {
        if (this.tokens >= count) {
          this.tokens -= count;
          return this.tokens;
        } else {
          return -1; // Не хватает токенов, возвращаем отрицательное число
        }
      } else {
        // Ожидаем пока не наберется достаточно токенов
        while (this.tokens < count) {
          const waitTime = Math.ceil((count - this.tokens) / this.tokensPerInterval * this.interval);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          this.refillTokens();
        }
        this.tokens -= count;
        return this.tokens;
      }
    }

    tryRemoveTokens(count = 1) {
      this.refillTokens();
      if (this.tokens >= count) {
        this.tokens -= count;
        return true;
      }
      return false;
    }

    getTokensRemaining() {
      this.refillTokens();
      return this.tokens;
    }
  }

  // Создаем глобальные ограничители для разных типов операций
  const rateLimiters = {
    // Загрузка вакансий: 1 запрос в 2 секунды
    loadVacancies: new RateLimiter({
      tokensPerInterval: 1,
      interval: 2000,
      fireImmediately: true
    }),
    
    // Поиск: 3 запроса в 5 секунд
    search: new RateLimiter({
      tokensPerInterval: 3,
      interval: 5000,
      fireImmediately: true
    }),
    
    // Добавление в избранное: 5 запросов в минуту
    favorite: new RateLimiter({
      tokensPerInterval: 5,
      interval: 'minute',
      fireImmediately: true
    }),
    
    // Обновление статуса: 10 запросов в минуту
    updateStatus: new RateLimiter({
      tokensPerInterval: 10,
      interval: 'minute',
      fireImmediately: true
    }),
    
    // Pull-to-refresh: 1 запрос в 3 секунды
    refresh: new RateLimiter({
      tokensPerInterval: 1,
      interval: 3000,
      fireImmediately: true
    })
  };

  // Функция проверки rate limit с user-friendly сообщениями
  async function checkRateLimit(operation, count = 1) {
    const limiter = rateLimiters[operation];
    if (!limiter) {
      console.warn(`Rate limiter для операции "${operation}" не найден`);
      return { allowed: true };
    }

    const remaining = await limiter.removeTokens(count);
    
    if (remaining < 0) {
      // Определяем сообщение в зависимости от операции
      const messages = {
        loadVacancies: 'Подождите 2 секунды перед следующей загрузкой',
        search: 'Слишком много поисковых запросов. Подождите 5 секунд',
        favorite: 'Лимит добавления в избранное превышен. Подождите минуту',
        updateStatus: 'Слишком много обновлений. Подождите минуту',
        refresh: 'Подождите 3 секунды перед повторным обновлением'
      };
      
      return {
        allowed: false,
        message: messages[operation] || 'Слишком много запросов. Подождите немного',
        remainingTokens: 0
      };
    }

    return {
      allowed: true,
      remainingTokens: remaining
    };
  }

  function setupPullToRefresh(options = {}) {
     const { onRefresh, refreshEventName } = options;
     if (typeof onRefresh !== 'function' || !refreshEventName) {
       return;
     }
     
     // Определяем, находимся ли мы в Mini App
     const isMiniApp = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
 
    const wrapper = document.querySelector('.main-wrapper');
    const ptrBar = wrapper?.querySelector('.ptr-bar');
    if (!wrapper || !ptrBar) {
      return;
    }

    // Динамически создаем контент для плашки
    ptrBar.innerHTML = `
      <div class="ptr-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <polyline points="19 12 12 19 5 12"></polyline>
        </svg>
      </div>
      <div class="ptr-spinner retro-spinner-inline"></div>
      <span class="ptr-text">Потяните для обновления</span>
    `;
    
    const ptrText = ptrBar.querySelector('.ptr-text');
              // В Mini App делаем PTR максимально простым
     const THRESHOLD = isMiniApp ? 15 : (CFG.PTR_CONFIG?.THRESHOLD || 60);
     const BAR_HEIGHT = CFG.PTR_CONFIG?.BAR_HEIGHT || 75;

    let startY = 0;
    let pullDistance = 0;
    let state = 'waiting'; // 'waiting', 'pulling', 'refreshing'

    const setState = (newState) => {
      if (state === newState) return;
      state = newState;

      switch(state) {
                 case 'waiting':
           wrapper.classList.remove('ptr-pulling');
           ptrBar.classList.remove('ptr-visible', 'ptr-ready', 'ptr-refreshing');
           wrapper.style.transition = 'transform 0.3s ease-out';
           wrapper.style.transform = 'translateY(0px)';
           break;

        case 'pulling':
          wrapper.classList.add('ptr-pulling');
          ptrBar.classList.add('ptr-visible');
          break;

                 case 'refreshing':
           wrapper.classList.remove('ptr-pulling');
           ptrBar.classList.add('ptr-refreshing');
           wrapper.style.transition = 'transform 0.3s ease-out';
           wrapper.style.transform = `translateY(${BAR_HEIGHT}px)`;
           ptrText.textContent = 'Обновление...';
          
          // Безопасный вызов HapticFeedback с проверкой версии
          if (tg && tg.HapticFeedback && tg.HapticFeedback.impactOccurred) {
            try {
              // Проверяем что версия поддерживает HapticFeedback (6.1+)
              if (tg.version && parseFloat(tg.version) >= 6.1) {
                tg.HapticFeedback.impactOccurred('medium');
              }
            } catch (error) {
              // Игнорируем ошибки HapticFeedback для совместимости
              console.debug('HapticFeedback не поддерживается в этой версии:', error.message);
            }
          }

          // Проверяем rate limit для refresh операции
          checkRateLimit('refresh').then(rateResult => {
            if (!rateResult.allowed) {
              // Показываем сообщение о rate limit и возвращаемся к waiting
              ptrText.textContent = rateResult.message;
              setTimeout(() => setState('waiting'), 2000);
              return;
            }
            
            // Если rate limit не превышен, выполняем обновление
            // Добавляем флаг isPullToRefresh чтобы fetchNext знал что это PTR
            if (typeof onRefresh === 'function') {
              onRefresh(true); // Передаем флаг isPullToRefresh
            }
          });
          
          const safetyTimeout = setTimeout(() => {
            if (state === 'refreshing') setState('waiting');
          }, 8000);

          const onLoaded = () => {
            clearTimeout(safetyTimeout);
            document.removeEventListener(refreshEventName, onLoaded);
            setState('waiting');
          };
          document.addEventListener(refreshEventName, onLoaded);
          break;
      }
    };

         const handleTouchStart = (e) => {
       if (state !== 'waiting' || window.scrollY > 0) return;
       
       const touchY = e.touches[0].clientY;
       
       // В Mini App делаем зону безопасности минимальной
       const safeZone = isMiniApp ? 5 : 30;
       if (touchY < safeZone) return;
       
       startY = touchY;
       
       // В Mini App активируем PTR мгновенно
       if (isMiniApp) {
         setState('pulling');
         // Сразу показываем плашку
         ptrBar.classList.add('ptr-visible');
       }
     };

         const handleTouchMove = (e) => {
       // В браузере активируем PTR при движении
       if (state === 'waiting' && startY !== 0 && !isMiniApp) {
         const currentY = e.touches[0].clientY;
         const moveDistance = currentY - startY;
         
         if (moveDistance > 15) {
           setState('pulling');
         }
         return;
       }
       
       // В Mini App PTR уже активен, просто обрабатываем движение
       if (state !== 'pulling') return;
       
       pullDistance = e.touches[0].clientY - startY;
       
       if (pullDistance > 0) {
         // Только вызываем preventDefault если событие действительно cancelable
         // Это предотвращает ошибку Intervention
         try {
           if (e.cancelable) {
             e.preventDefault();
           }
         } catch (error) {
           // Игнорируем ошибки preventDefault для совместимости
           console.debug('preventDefault не удался:', error.message);
         }
         
         // В Mini App делаем сопротивление более плавным, но все еще легким
         const resistance = isMiniApp ? 0.6 : 0.7;
         const dragDistance = Math.pow(pullDistance, resistance);
         wrapper.style.transform = `translateY(${dragDistance}px)`;
         wrapper.style.transition = 'transform 0.1s ease-out';
         
                    // В Mini App делаем активацию более плавной
           if (isMiniApp) {
             // Показываем "готово" при движении больше 15px для плавности
             if (dragDistance > 15) {
               ptrBar.classList.add('ptr-ready');
               ptrText.textContent = 'Отпустите для обновления';
             } else {
               ptrBar.classList.remove('ptr-ready');
               ptrText.textContent = 'Потяните для обновления';
             }
           } else {
           // В браузере обычная логика
           if (dragDistance > THRESHOLD) {
             ptrBar.classList.add('ptr-ready');
             ptrText.textContent = 'Отпустите для обновления';
           } else {
             ptrBar.classList.remove('ptr-ready');
             ptrText.textContent = 'Потяните для обновления';
           }
         }
       }
     };

         const handleTouchEnd = () => {
       if (state === 'pulling') {
         if (isMiniApp) {
           // В Mini App обновление срабатывает при движении больше 10px для плавности
           if (pullDistance > 10) {
             setState('refreshing');
           } else {
             setState('waiting');
           }
         } else {
           // В браузере обычная логика
           if (Math.pow(pullDistance, 0.85) > THRESHOLD) {
             setState('refreshing');
           } else {
             setState('waiting');
           }
         }
         pullDistance = 0;
       }
       
       // Сбрасываем startY в любом случае
       startY = 0;
     };

    // Добавляем listeners с возможностью очистки
    // Используем более умную стратегию для passive событий
    document.body.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
    
    // Для touchmove пробуем сначала non-passive, если не работает - fallback на passive
    try {
      document.body.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
    } catch (error) {
      // Fallback для браузеров, которые принудительно делают touchmove passive
      console.debug('Используем passive touchmove для совместимости');
      document.body.addEventListener('touchmove', handleTouchMove, { passive: true, capture: true });
    }
    
    document.body.addEventListener('touchend', handleTouchEnd, { passive: true, capture: true });
    
    // Сохраняем cleanup функцию для возможности удаления listeners
    wrapper.ptrCleanup = () => {
      document.body.removeEventListener('touchstart', handleTouchStart, { capture: true });
      // Удаляем touchmove обработчик (пробуем оба варианта для надежности)
      try {
        document.body.removeEventListener('touchmove', handleTouchMove, { capture: true });
      } catch (error) {
        console.debug('Cleanup touchmove fallback');
      }
      document.body.removeEventListener('touchend', handleTouchEnd, { capture: true });
    };
  }


  // Глобальный менеджер очистки listeners
  const GlobalCleanupManager = {
    listeners: new Set(),
    
    // Добавить listener с автоматической очисткой
    addManagedListener(element, event, handler, options = {}) {
      if (!element) return null;
      
      element.addEventListener(event, handler, options);
      const listenerInfo = { element, event, handler, options };
      this.listeners.add(listenerInfo);
      
      // Возвращаем функцию для ручного удаления
      return () => {
        this.removeManagedListener(listenerInfo);
      };
    },
    
    // Удалить конкретный listener
    removeManagedListener(listenerInfo) {
      const { element, event, handler } = listenerInfo;
      try {
        element.removeEventListener(event, handler);
        this.listeners.delete(listenerInfo);
      } catch (error) {
        console.warn('Ошибка удаления listener:', error);
      }
    },
    
    // Очистить все listeners
    cleanup() {
      for (const listenerInfo of this.listeners) {
        this.removeManagedListener(listenerInfo);
      }
      this.listeners.clear();
    },
    
    // Получить статистику
    getStats() {
      return {
        totalListeners: this.listeners.size,
        types: Array.from(this.listeners).reduce((acc, { event }) => {
          acc[event] = (acc[event] || 0) + 1;
          return acc;
        }, {})
      };
    }
  };
  
  // Telegram WebApp cleanup function
  function setupTelegramCleanup() {
    if (!tg) return;
    
    // Очистка при закрытии WebApp
    GlobalCleanupManager.addManagedListener(window, 'beforeunload', () => {
      GlobalCleanupManager.cleanup();
      window.appController?.destroy();
      window.eventManager?.destroy();
    });
    
    // Очистка при смене видимости
    GlobalCleanupManager.addManagedListener(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // Мягкая очистка неактивных listeners
        window.eventManager?.getStats && console.log('Event Manager Stats:', window.eventManager.getStats());
        window.appController?.getStats && console.log('App Controller Stats:', window.appController.getStats());
      }
    });
  }

  window.utils = {
    tg, 
    escapeHtml, 
    stripTags, 
    debounce, 
    highlightText,
    setHighlightedText, 
    safeAlert, 
    uiToast,
    formatTimestamp, 
    sanitizeLink, 
    openLink,
    containsImageMarker, 
    cleanImageMarkers, 
    pickImageUrl,
    fetchWithRetry, 
    renderEmptyState, 
    renderError,
    ensureLoadMore, 
    updateLoadMore,
    createVacancyCard,
    setupPullToRefresh,
    showCustomConfirm,
    createSupabaseHeaders,
    parseTotal,
    checkRateLimit, // <-- Rate Limiter функция
    RateLimiter,    // <-- Класс для создания кастомных лимитеров
    GlobalCleanupManager, // <-- Менеджер автоматической очистки listeners
    setupTelegramCleanup  // <-- Настройка cleanup для Telegram WebApp
  };
  
  // Автоматическая инициализация cleanup для Telegram WebApp
  setupTelegramCleanup();

})();
