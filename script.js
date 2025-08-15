// script.js — главная страница

(function () {
  'use strict';
  
  const CFG = window.APP_CONFIG || {};
  const UTIL = window.utils || {};

  if (!CFG || !UTIL) {
    alert('Критическая ошибка: не удалось загрузить config.js или utils.js');
    return;
  }

  const {
    PAGE_SIZE_MAIN,
    RETRY_OPTIONS,
    SEARCH_FIELDS,
    STATUSES,
    CATEGORIES
  } = CFG;

  const {
    debounce,
    safeAlert,
    uiToast,
    openLink,
    fetchWithRetry,
    renderEmptyState,
    renderError,
    ensureLoadMore,
    updateLoadMore,
    createVacancyCard,
    setupPullToRefresh,
    showCustomConfirm,
    createSupabaseHeaders,
    parseTotal
  } = UTIL;

  // Кэшируем DOM элементы с проверкой на null
  const containers = {
    main:  document.getElementById('vacancies-list-main'),
    maybe: document.getElementById('vacancies-list-maybe'),
    other: document.getElementById('vacancies-list-other'),
  };
  
  const counts = {
    main:  document.getElementById('count-main'),
    maybe: document.getElementById('count-maybe'),
    other: document.getElementById('count-other'),
  };

  // Контейнеры будут проверены в соответствующих функциях

  const tabButtons      = document.querySelectorAll('.tab-button');
  const vacancyLists    = document.querySelectorAll('.vacancy-list');
  let searchInput       = document.getElementById('search-input');
  const mainHeader      = document.getElementById('main-header');
  const vacanciesContent= document.getElementById('vacancies-content');
  const loader          = document.getElementById('loader');
  let searchClearBtn    = document.getElementById('search-clear-btn');
  let searchInputWrapper = searchInput?.parentElement;

  const state = {
    query: '',
    activeKey: 'main',
    main:  { offset:0, total:0, busy:false, loadedOnce:false, loadedForQuery:'' },
    maybe: { offset:0, total:0, busy:false, loadedOnce:false, loadedForQuery:'' },
    other: { offset:0, total:0, busy:false, loadedOnce:false, loadedForQuery:'' },
  };
  let currentController = null;

  function showLoader() {
    if (loader) {
      loader.classList.remove('hidden');
      // Добавляем класс для анимации появления
      loader.classList.add('loading');
    }
  }
  function hideLoader() {
    if (loader) {
      loader.classList.remove('loading');
      loader.classList.add('hidden');
    }
  }

  let searchStatsEl=null;
  function ensureSearchUI(){
    const searchContainer = document.getElementById('search-container');
    if(!searchContainer || searchStatsEl || !searchInputWrapper) return;
    searchStatsEl=document.createElement('div');
    searchStatsEl.className='search-stats';
    searchInputWrapper.insertAdjacentElement('afterend', searchStatsEl);
  }
  function updateSearchStats(){
    ensureSearchUI();
    const active = containers[state.activeKey];
    if(!active || !searchStatsEl){
        if(searchStatsEl) searchStatsEl.textContent='';
        return;
    }
    const visible = active.querySelectorAll('.vacancy-card').length;
    const total   = state[state.activeKey].total || visible;
    const q = (searchInput?.value||'').trim();
    
    // Безопасное обновление текста
    const statsText = q ? (visible === 0 ? 'Ничего не найдено' : `Найдено: ${visible} из ${total}`) : '';
    if (searchStatsEl) {
      if(searchStatsEl) searchStatsEl.textContent = statsText;
    }
  }

  function abortCurrent(){
    if(currentController && !currentController.signal.aborted){ 
      try{ 
        currentController.abort(); 
      } catch(error) {
        console.warn('Ошибка отмены запроса:', error);
      }
    }
    currentController = new AbortController();
    return currentController;
  }
  
  function keyFromTargetId(targetId){
    if (targetId.endsWith('-main'))  return 'main';
    if (targetId.endsWith('-maybe')) return 'maybe';
    return 'other';
  }
  function clearContainer(el){
    if(!el) return;
    const lm=el.querySelector('.load-more-wrap');
    if(el) {
      el.innerHTML='';
      if(lm) el.appendChild(lm);
    }
  }
  function hideLoadMore(container){
    updateLoadMore?.(container, false);
    const lm=container?.querySelector('.load-more-wrap');
    if(lm) lm.remove();
  }
  function pinLoadMoreToBottom(container){
    const wrap=container?.querySelector('.load-more-wrap');
    if(wrap && container) container.appendChild(wrap);
  }

  function buildCategoryUrl(key, limit, offset, query){
    const p = new URLSearchParams();
    p.set('select', '*');
    p.set('status', `eq.${STATUSES.NEW}`);
    p.set('order', 'timestamp.desc');
    p.set('limit', String(limit));
    p.set('offset', String(offset));

    if (key === 'main') p.set('category', `eq.${CATEGORIES.MAIN}`);
    else if (key === 'maybe') p.set('category', `eq.${CATEGORIES.MAYBE}`);
    else p.set('category', `not.in.("${CATEGORIES.MAIN}","${CATEGORIES.MAYBE}")`);

    const q = (query || '').trim();
    if (q && Array.isArray(SEARCH_FIELDS) && SEARCH_FIELDS.length){
      const orExpr = '(' + SEARCH_FIELDS.map(f => `${f}.ilike.*${q}*`).join(',') + ')';
      p.set('or', orExpr);
    }
    return `${CFG.SUPABASE_URL}/rest/v1/vacancies?${p.toString()}`;
  }

  async function fetchCountsAll(query){
    const fetchCount = async (key) => {
        const p = new URLSearchParams();
        p.set('select', 'id');
        p.set('status', `eq.${STATUSES.NEW}`);
        p.set('limit', '1');
        
        if (key === 'main') p.set('category', `eq.${CATEGORIES.MAIN}`);
        else if (key === 'maybe') p.set('category', `eq.${CATEGORIES.MAYBE}`);
        else p.set('category', `not.in.("${CATEGORIES.MAIN}","${CATEGORIES.MAYBE}")`);

        const q = (query || '').trim();
        if (q && Array.isArray(SEARCH_FIELDS) && SEARCH_FIELDS.length){
          const orExpr = '(' + SEARCH_FIELDS.map(f => `${f}.ilike.*${q}*`).join(',') + ')';
          p.set('or', orExpr);
        }
        
        const url = `${CFG.SUPABASE_URL}/rest/v1/vacancies?${p.toString()}`;
        
        // Увеличиваем таймаут для мобильных устройств
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 секунд для мобильных
        
        try {
        const resp = await fetchWithRetry(url, {
            headers: createSupabaseHeaders({ prefer: 'count=exact' }),
            signal: controller.signal
        }, RETRY_OPTIONS);
        if(!resp.ok) throw new Error('count failed');
        return parseTotal(resp);
        } finally {
          clearTimeout(timeoutId);
        }
    };
    
    try {
      // Загружаем счетчики последовательно для лучшей производительности на мобильных
      const mainCount = await fetchCount('main').catch(() => 0);
      const maybeCount = await fetchCount('maybe').catch(() => 0);
      const otherCount = await fetchCount('other').catch(() => 0);
      
      // Безопасно обновляем счетчики с проверкой существования элементов
      state.main.total = mainCount;  if(counts.main) counts.main.textContent = `(${mainCount})`;
      state.maybe.total = maybeCount; if(counts.maybe) counts.maybe.textContent = `(${maybeCount})`;
      state.other.total = otherCount; if(counts.other) counts.other.textContent = `(${otherCount})`;
      
    } catch(e) { 
      console.warn('Ошибка загрузки счетчиков:', e);
      // Fallback: устанавливаем нули и продолжаем работу с проверками
      state.main.total = 0; if(counts.main) counts.main.textContent = '(0)';
      state.maybe.total = 0; if(counts.maybe) counts.maybe.textContent = '(0)';
      state.other.total = 0; if(counts.other) counts.other.textContent = '(0)';
      
      // Не блокируем основную загрузку из-за ошибки счетчиков
      // Пользователь все равно увидит вакансии
    }
  }

  vacanciesContent?.addEventListener('click', (e) => {
    
    const btn = e.target.closest('[data-action]');
    if (!btn) {
      return;
    }
    
    const action = btn.dataset.action;
    
    if (action === 'apply') {
      openLink(btn.dataset.url);
    }
    if (action === 'favorite') {
      updateStatus(btn.dataset.id, STATUSES.FAVORITE);
    }
    if (action === 'delete') {
      updateStatus(btn.dataset.id, STATUSES.DELETED);
    }
  });

  async function updateStatus(id, newStatus){
    if (!id) return;
    const isFavorite = newStatus === STATUSES.FAVORITE;
    
    if (isFavorite) {
        const ok = await showCustomConfirm('Добавить в избранное?');
        if (!ok) return;
    }
    
    const cardEl = document.querySelector(`#card-${CSS.escape(id)}`);
    if (!cardEl) return;
    
    cardEl.style.transition = 'opacity .3s, transform .3s, max-height .3s, margin .3s, padding .3s, border-width .3s';
    cardEl.style.opacity = '0';
    cardEl.style.transform = 'scale(0.95)';
    cardEl.style.maxHeight = '0px';
    cardEl.style.paddingTop = '0';
    cardEl.style.paddingBottom = '0';
    cardEl.style.marginTop = '0';
    cardEl.style.marginBottom = '0';
    cardEl.style.borderWidth = '0';
    
    const parent = cardEl.parentElement;
    const nextSibling = cardEl.nextElementSibling;
    
    const onUndo = () => {
        parent.insertBefore(cardEl, nextSibling);
        requestAnimationFrame(() => {
            cardEl.style.opacity = '1';
            cardEl.style.transform = 'scale(1)';
            cardEl.style.maxHeight = '500px';
            cardEl.style.paddingTop = '';
            cardEl.style.paddingBottom = '';
            cardEl.style.marginTop = '';
            cardEl.style.marginBottom = '';
            cardEl.style.borderWidth = '';
        });
    };
    
    uiToast(isFavorite ? 'Добавлено в избранное' : 'Вакансия удалена', {
      timeout: 5000,
      onUndo: onUndo,
      onTimeout: async () => {
          try {
            cardEl.remove();
            const url = `${CFG.SUPABASE_URL}/rest/v1/vacancies?id=eq.${encodeURIComponent(id)}`;
            const resp = await fetchWithRetry(url, {
              method: 'PATCH',
              headers: createSupabaseHeaders({ prefer: 'return=minimal' }),
              body: JSON.stringify({ status: newStatus }),
            }, RETRY_OPTIONS);
            if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
            
            const k = state.activeKey;
            if (state[k].total > 0) state[k].total -= 1;
            if(counts[k]) counts[k].textContent = `(${state[k].total})`;
            if (parent && parent.querySelectorAll('.vacancy-card').length === 0) {
                renderEmptyState(parent, '-- Пусто в этой категории --');
            }
          } catch(err) {
            safeAlert('Не удалось выполнить действие.');
            onUndo();
          }
      }
    });
  }

  async function fetchNext(key, isInitialLoad = false) {
    
    const st = state[key];
    const container = containers[key];
    
    
    if (!container || st.busy) {
      return;
    }
    
    st.busy = true;

    if (st.offset === 0 && !isInitialLoad) {
        if(container) container.innerHTML = '<div class="empty-list"><div class="retro-spinner-inline"></div> Загрузка...</div>';
    }

    const url = buildCategoryUrl(key, PAGE_SIZE_MAIN || 10, st.offset, state.query);
    
    const controller = abortCurrent();

    try {
      // Увеличиваем таймаут для мобильных устройств
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 секунд для мобильных
      
      try {
      const resp = await fetchWithRetry(url, {
        headers: createSupabaseHeaders({ prefer: 'count=exact' }),
        signal: controller.signal
      }, RETRY_OPTIONS);
        
        clearTimeout(timeoutId);
        
      if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);

      const total = parseTotal(resp);
        
      if (Number.isFinite(total)){ st.total = total; if(counts[key]) counts[key].textContent = `(${total})`; }

      const data = await resp.json();
      
      // Валидация данных API
      if (!Array.isArray(data)) {
        throw new Error('API вернул некорректный формат данных (ожидался массив)');
      }
      
      const items = data.filter(item => item && typeof item === 'object' && item.id);
      
      if (st.offset === 0) {
          clearContainer(container);
      }

      if (items.length === 0) {
        if (st.offset === 0) {
            const message = state.query ? 'По вашему запросу ничего не найдено' : '-- Пусто в этой категории --';
            renderEmptyState(container, message);
        }
      } else {
        const frag = document.createDocumentFragment();
        for (const it of items) frag.appendChild(createVacancyCard(it, { pageType: 'main', searchQuery: state.query }));
        if(container) container.appendChild(frag);
        pinLoadMoreToBottom(container);

        const { btn } = ensureLoadMore(container, () => fetchNext(key));
        st.offset += items.length;
        const hasMore = st.offset < st.total;
        updateLoadMore(container, hasMore);
        if (btn) btn.disabled = !hasMore;
      }
      st.loadedOnce = true;
      st.loadedForQuery = state.query;
      updateSearchStats();
        
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
      
    } catch(e) {
      if (e.name === 'AbortError') {
      if (st.offset === 0) {
          renderError(container, 'Превышено время ожидания. Проверьте соединение.', () => refetchFromZeroSmooth(key));
        }
        return;
      }
      
      if (st.offset === 0) {
        const errorMessage = e.message.includes('Failed to fetch') || e.message.includes('NetworkError') 
          ? 'Ошибка сети. Проверьте соединение.' 
          : e.message;
        renderError(container, errorMessage, () => refetchFromZeroSmooth(key));
      }
    } finally {
      st.busy = false;
      if (isInitialLoad) {
          hideLoader();
      }
      document.dispatchEvent(new CustomEvent(`feed:loaded`));
    }
  }
  
  async function refetchFromZeroSmooth(key) {
    const st = state[key];
    const container = containers[key];
    if (!container || st.busy) return;
    st.offset = 0;
    await fetchNext(key, false);
  }

  async function seamlessSearch(key) {
      const st = state[key];
      const container = containers[key];
      if (!container || st.busy) return;
      
      st.busy = true;
      st.offset = 0;
      
      // Убираем полупрозрачность - это вызывало баг
      // container.classList.add('loading-seamless');

      const url = buildCategoryUrl(key, PAGE_SIZE_MAIN || 10, 0, state.query);
      const controller = abortCurrent();
      
      // Добавляем таймаут для поиска на мобильных устройствах
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 секунд для мобильных

      try {
          const resp = await fetchWithRetry(url, {
              headers: createSupabaseHeaders({ prefer: 'count=exact' }),
              signal: controller.signal
          }, RETRY_OPTIONS);
          
          clearTimeout(timeoutId);

          if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);

          const total = parseTotal(resp);
          if (Number.isFinite(total) && counts[key]) { counts[key].textContent = `(${total})`; }

          const items = await resp.json();
          
          const frag = document.createDocumentFragment();
          if (items.length === 0) {
              const message = state.query ? 'По вашему запросу ничего не найдено' : '-- Пусто в этой категории --';
              const emptyEl = document.createElement('div');
              renderEmptyState(emptyEl, message);
              frag.appendChild(emptyEl.firstElementChild);
          } else {
              items.forEach(it => frag.appendChild(createVacancyCard(it, { pageType: 'main', searchQuery: state.query })));
              
              st.offset = items.length;
              const hasMore = st.offset < total;
              const { wrap } = ensureLoadMore(document.createElement('div'), () => fetchNext(key));
              updateLoadMore(wrap, hasMore);
              if(frag) frag.appendChild(wrap);
          }
          container.replaceChildren(frag);

          st.loadedOnce = true;
          st.loadedForQuery = state.query;
          updateSearchStats();
      } catch (e) {
          clearTimeout(timeoutId);
          if (e.name === 'AbortError') {
                  renderError(container, 'Превышено время ожидания поиска. Проверьте соединение.', () => seamlessSearch(key));
          } else if (e.name !== 'AbortError') {
              const errorMessage = e.message.includes('Failed to fetch') || e.message.includes('NetworkError') 
                ? 'Ошибка сети при поиске. Проверьте соединение.' 
                : e.message;
              renderError(container, errorMessage, () => seamlessSearch(key));
          }
      } finally {
          st.busy = false;
          // Убираем полупрозрачность - это вызывало баг
          // container.classList.remove('loading-seamless');
      }
  }

  const onSearch = debounce(() => {
    state.query = (searchInput?.value || '').trim();
    fetchCountsAll(state.query);
    seamlessSearch(state.activeKey);
    ['main', 'maybe', 'other'].forEach(key => {
      if (key !== state.activeKey) {
        const st = state[key];
        st.loadedOnce = false;
        st.loadedForQuery = '';
        st.offset = 0;
        clearContainer(containers[key]);
        hideLoadMore(containers[key]);
      }
    });
  }, 300);
  
  searchInput?.addEventListener('input', () => {
      searchInputWrapper?.classList.toggle('has-text', searchInput.value.length > 0);
      onSearch();
  });
  searchClearBtn?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInputWrapper?.classList.remove('has-text');
        onSearch();
        searchInput.focus();
      }
  });

  function showOnly(targetId){
    vacancyLists.forEach(list=>{
      list.classList.remove('active');
      list.style.display='none';
    });
    const target=document.getElementById(targetId);
    if(target){ target.classList.add('active'); target.style.display=''; }
  }
  
  async function activateTabByTarget(targetId){
    const key = keyFromTargetId(targetId);
    state.activeKey = key;

    tabButtons.forEach(b => {
      const active = b.dataset.target === targetId;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    showOnly(targetId);
    updateSearchStats();

    const st = state[key];
    if (!st.loadedOnce || st.loadedForQuery !== state.query) {
       await fetchNext(key, false);
    }
  }

  async function bulkDeleteCategory(key) {
    const ok = await showCustomConfirm('Удалить ВСЕ вакансии в этой категории?');
    if(!ok) return;

    try {
        const p = new URLSearchParams();
        p.set('status', `eq.${STATUSES.NEW}`);
        if (key === 'main') p.set('category', `eq.${CATEGORIES.MAIN}`);
        else if (key === 'maybe') p.set('category', `eq.${CATEGORIES.MAYBE}`);
        else p.set('category', `not.in.("${CATEGORIES.MAIN}","${CATEGORIES.MAYBE}")`);

        const url = `${CFG.SUPABASE_URL}/rest/v1/vacancies?${p.toString()}`;
        const resp = await fetchWithRetry(url, {
            method: 'PATCH',
            headers: createSupabaseHeaders({ prefer: 'return=minimal' }),
            body: JSON.stringify({ status: STATUSES.DELETED }),
        }, RETRY_OPTIONS);

        if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);

        clearContainer(containers[key]);
        state[key] = { offset: 0, total: 0, busy: false, loadedOnce: true, loadedForQuery: state.query };
        counts[key].textContent = '(0)';
        hideLoadMore(containers[key]);
        renderEmptyState(containers[key], '-- Пусто в этой категории --');
        uiToast('Категория очищена');

    } catch(e) {
        console.error(e);
        safeAlert('Не удалось удалить вакансии из этой категории. Попробуйте позже.');
    }
  }

  tabButtons.forEach(btn=>{
    
    let pressTimer = null;
    let isHeld = false;
    const holdMs = 1200; // Увеличиваем время для предотвращения случайных срабатываний

    const start = (e) => {
      isHeld = false;
      btn.classList.add('pressing');
      
      // Добавляем проверку на движение пальца
      let hasMoved = false;
      const startX = e.clientX || e.touches?.[0]?.clientX || 0;
      const startY = e.clientY || e.touches?.[0]?.clientY || 0;
      
      const checkMovement = (e) => {
        const currentX = e.clientX || e.touches?.[0]?.clientX || 0;
        const currentY = e.clientY || e.touches?.[0]?.clientY || 0;
        const distance = Math.sqrt((currentX - startX) ** 2 + (currentY - startY) ** 2);
        
        if (distance > 10) { // Если палец сдвинулся больше чем на 10px
          hasMoved = true;
          cancel(e);
        }
      };
      
      // Добавляем слушатели для отслеживания движения
      document.addEventListener('pointermove', checkMovement, { passive: true });
      document.addEventListener('touchmove', checkMovement, { passive: true });
      
      pressTimer = setTimeout(() => {
        if (!hasMoved) {
          isHeld = true;
          btn.classList.remove('pressing');
          const key = keyFromTargetId(btn.dataset.target || '');
          bulkDeleteCategory(key);
        }
      }, holdMs);
      
      // Сохраняем ссылку на функцию для очистки
      btn._checkMovement = checkMovement;
    };
    
    const cancel = (e) => {
      btn.classList.remove('pressing');
      clearTimeout(pressTimer);
      
      // Очищаем слушатели движения
      if (btn._checkMovement) {
        document.removeEventListener('pointermove', btn._checkMovement);
        document.removeEventListener('touchmove', btn._checkMovement);
        delete btn._checkMovement;
      }
    };

    const clickHandler = (e) => {
        if (isHeld) {
            e.preventDefault();
            e.stopPropagation();
        } else {
            const targetId = btn.dataset.target;
            if(targetId) activateTabByTarget(targetId);
        }
    };

    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', cancel);
    btn.addEventListener('pointerleave', cancel);
    btn.addEventListener('click', clickHandler);
    
  });

  // Улучшенное определение мобильных устройств
  function isMobileDevice() {
    // Проверяем различные признаки мобильного устройства
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    
    // Основные мобильные платформы
    const mobilePlatforms = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i;
    
    // Проверяем размер экрана
    const isSmallScreen = window.innerWidth <= 768;
    
    // Проверяем touch поддержку
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Проверяем, что это НЕ iPad (iPad может работать как десктоп)
    const isIPad = /iPad/.test(userAgent) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    // Определяем как мобильное, если это не iPad и есть признаки мобильного
    const isMobile = mobilePlatforms.test(userAgent) && !isIPad && (isSmallScreen || hasTouch);
    
    
    return isMobile;
  }

  // Fallback обработчики для мобильных устройств
  function setupMobileFallbacks() {
    
    const isMobile = isMobileDevice();
    
    if (isMobile) {
      // Добавляем touchstart обработчики как fallback
      
      // Обработчики для кнопок действий
      document.addEventListener('touchstart', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        
        
        // Предотвращаем двойное срабатывание
        e.preventDefault();
        
        const action = btn.dataset.action;
        if (action === 'apply') {
          openLink(btn.dataset.url);
        } else if (action === 'favorite') {
          updateStatus(btn.dataset.id, STATUSES.FAVORITE);
        } else if (action === 'delete') {
          updateStatus(btn.dataset.id, STATUSES.DELETED);
        }
      }, { passive: false });
      
      // Обработчики для вкладок - используем более мягкий подход
      document.addEventListener('touchstart', (e) => {
        const tab = e.target.closest('.tab-button');
        if (!tab) return;
        
        
        // НЕ предотвращаем по умолчанию - это может конфликтовать с PTR
        // Вместо этого используем touchend для активации
      }, { passive: true });
      
      // Активируем вкладку только при touchend
      document.addEventListener('touchend', (e) => {
        const tab = e.target.closest('.tab-button');
        if (!tab) return;
        
        
        const targetId = tab.dataset.target;
        if (targetId) {
          activateTabByTarget(targetId);
        }
      });
      
      // Обработчики для поиска
      if (searchInput) {
        searchInput.addEventListener('touchstart', (e) => {
          searchInput.focus();
        });
      }
      
      // Дополнительные обработчики для мобильных устройств
      
      // Обработчик для всех кликабельных элементов
      document.addEventListener('touchend', (e) => {
        const target = e.target;
        
        // Проверяем, есть ли у элемента data-action
        if (target.hasAttribute('data-action')) {
          // Не вызываем действие здесь, оно уже обработано в touchstart
        }
        
        // Проверяем, есть ли у элемента класс tab-button
        if (target.classList.contains('tab-button')) {
          // Не вызываем действие здесь, оно уже обработано в touchstart
        }
      });
      
      // Обработчик для предотвращения zoom на двойное касание
      let lastTouchEnd = 0;
      document.addEventListener('touchend', (e) => {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
          e.preventDefault();
        }
        lastTouchEnd = now;
      }, false);
      
    } else {
    }
  }

  // Делегирование событий для мобильных устройств
  function setupEventDelegation() {
    
    const isMobile = isMobileDevice();
    
    if (isMobile) {
      
      // Используем делегирование для всех кликабельных элементов
      document.addEventListener('click', (e) => {
        // Обработка кнопок действий
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
          
          const action = actionBtn.dataset.action;
          if (action === 'apply') {
            openLink(actionBtn.dataset.url);
          } else if (action === 'favorite') {
            updateStatus(actionBtn.dataset.id, STATUSES.FAVORITE);
          } else if (action === 'delete') {
            updateStatus(actionBtn.dataset.id, STATUSES.DELETED);
          }
          return;
        }
        
        // Обработка вкладок
        const tabBtn = e.target.closest('.tab-button');
        if (tabBtn) {
          
          const targetId = tabBtn.dataset.target;
          if (targetId) {
            activateTabByTarget(targetId);
          }
          return;
        }
        
        // Обработка кнопки "Загрузить ещё"
        const loadMoreBtn = e.target.closest('.load-more-btn');
        if (loadMoreBtn) {
          
          const container = loadMoreBtn.closest('.vacancy-list');
          if (container) {
            const key = container.id.replace('vacancies-list-', '');
            fetchNext(key, false);
          }
          return;
        }
        
        // Обработка кнопки очистки поиска
        if (e.target.id === 'search-clear-btn') {
          
          if (searchInput) {
            searchInput.value = '';
            searchInputWrapper?.classList.remove('has-text');
            onSearch();
            searchInput.focus();
          }
          return;
        }
      });
      
      // Дополнительная обработка для touch событий
      document.addEventListener('touchstart', (e) => {
        const target = e.target;
        
        // Добавляем визуальную обратную связь для touch (НО НЕ ДЛЯ ВКЛАДОК И КНОПКИ ОЧИСТКИ!)
        if (target.closest('[data-action], .load-more-btn')) {
          target.style.opacity = '0.7';
          target.style.transform = 'scale(0.98)';
          
          // Убираем эффект через 150ms
          setTimeout(() => {
            target.style.opacity = '';
            target.style.transform = '';
          }, 150);
        }
        
        // Отдельная обработка для кнопки очистки - только opacity, без transform
        if (target.closest('#search-clear-btn')) {
          target.style.opacity = '0.7';
          
          // Убираем эффект через 150ms
          setTimeout(() => {
            target.style.opacity = '';
          }, 150);
        }
      });
      
    } else {
    }
  }

  // Проверка доступности элементов перед добавлением обработчиков
  function ensureElementAccessibility() {
    
    const elements = {
      searchInput: document.getElementById('search-input'),
      searchClearBtn: document.getElementById('search-clear-btn'),
      searchInputWrapper: document.getElementById('search-input')?.parentElement,
      vacanciesContent: document.getElementById('vacancies-content')
    };
    
    const missing = Object.entries(elements)
      .filter(([key, el]) => !el)
      .map(([key]) => key);
    
    if (missing.length > 0) {
      console.warn('⚠️ Отсутствуют элементы:', missing);
      return false;
    }
    
    return true;
  }

  // Улучшенная обработка событий для мобильных устройств
  function setupMobileEventHandlers() {
    
    const isMobile = isMobileDevice();
    
    if (isMobile) {
      // Убираем стандартные обработчики событий, которые могут конфликтовать
      
      // Получаем элементы (используем глобальные переменные)
      
      // Очищаем существующие обработчики
      if (searchInput) {
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        // Обновляем ссылку
        searchInput = newSearchInput;
        
        // Обновляем searchInputWrapper
        searchInputWrapper = newSearchInput.parentElement;
        
        // Добавляем обработчики событий для нового элемента
        newSearchInput.addEventListener('input', () => {
          searchInputWrapper?.classList.toggle('has-text', newSearchInput.value.length > 0);
          onSearch();
        });
      }
      
      if (searchClearBtn) {
        const newSearchClearBtn = searchClearBtn.cloneNode(true);
        searchClearBtn.parentNode.replaceChild(newSearchClearBtn, searchClearBtn);
        // Обновляем ссылку
        searchClearBtn = newSearchClearBtn;
        
        // Добавляем обработчики событий для нового элемента
        newSearchClearBtn.addEventListener('click', () => {
          if (searchInput) {
            searchInput.value = '';
            searchInputWrapper?.classList.remove('has-text');
            onSearch();
            searchInput.focus();
          }
        });
      }
      
    } else {
    }
  }

  // Диагностика производительности для мобильных устройств (отключена в production)
  function setupMobilePerformanceMonitoring() {
    // FPS мониторинг отключен для улучшения производительности
    // В development режиме можно включить для отладки
    const isDevelopment = false; // Установить true только для отладки
    
    if (isDevelopment) {
      const isMobile = isMobileDevice();
      
      if (isMobile) {
        // Мониторинг FPS (только в development)
        let frameCount = 0;
        let lastTime = performance.now();
        
        function countFrames() {
          frameCount++;
          const currentTime = performance.now();
          
          if (currentTime - lastTime >= 1000) {
            const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
            
            if (fps < 30) {
              console.warn('⚠️ Низкая производительность: FPS < 30');
            }
            
            frameCount = 0;
            lastTime = currentTime;
          }
          
          requestAnimationFrame(countFrames);
        }
        
        // Запускаем мониторинг FPS только в development
        requestAnimationFrame(countFrames);
      }
    }
  }

  // Улучшенная функция инициализации
  async function init() {
    
    // Показываем лоадер в самом начале
    showLoader();
    
    // Увеличиваем таймаут для лоадера на мобильных устройствах
    const loaderTimeout = setTimeout(() => {
      console.warn('⚠️ Лоадер висит слишком долго, принудительно скрываем');
      hideLoader();
    }, 25000); // 25 секунд для мобильных устройств
    
    // Проверяем критические элементы
    
    if (!containers.main || !containers.maybe || !containers.other) {
      console.error('❌ Критическая ошибка: не найдены контейнеры для вакансий');
      hideLoader();
      safeAlert('Приложение не может запуститься. Перезагрузите страницу.');
      return;
    }


    Object.keys(containers).forEach(k => {
      containers[k].style.display = (k === state.activeKey) ? '' : 'none';
    });

    tabButtons.forEach(b => {
      const active = (b.dataset.target || '').endsWith('-main');
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    
    setupPullToRefresh({
        onRefresh: () => refetchFromZeroSmooth(state.activeKey),
        refreshEventName: 'feed:loaded'
    });
    
    // Настраиваем fallback для мобильных устройств
    setupMobileFallbacks();
    setupEventDelegation(); // Добавляем вызов новой функции
    
    // Проверяем доступность элементов и настраиваем обработчики
    if (ensureElementAccessibility()) {
      setupMobileEventHandlers();
      setupMobilePerformanceMonitoring(); // Добавляем вызов новой функции
    }
    
    // Приоритетная загрузка только основной категории для быстрого отображения
    try {
    await fetchNext('main', true);
      
      // Скрываем лоадер после загрузки основной категории
      clearTimeout(loaderTimeout);
      hideLoader();
      
    } catch (error) {
      console.error('❌ Ошибка загрузки основной категории:', error);
      clearTimeout(loaderTimeout);
      hideLoader();
      renderError(containers.main, error.message, () => refetchFromZeroSmooth('main'));
      return;
    }
    
    // Отложенная загрузка счетчиков и остальных категорий
    setTimeout(async () => {
      try {
        // Загружаем счетчики отдельно с увеличенным таймаутом
        await fetchCountsAll('');
      } catch (error) {
        console.warn('⚠️ Ошибка загрузки счетчиков:', error);
        // Не блокируем работу приложения
      }
      
      // Фоновая загрузка остальных категорий
        const backgroundLoads = ['maybe', 'other']
            .filter(k => !state[k].loadedOnce)
            .map(k => fetchNext(k, false).catch(error => {
                return null;
            }));
            
        if (backgroundLoads.length > 0) {
            await Promise.allSettled(backgroundLoads);
        }
    }, 1000); // Увеличиваем задержку до 1 секунды

    updateSearchStats();
  }
  
  function handlePageVisibility() {
      if (document.visibilityState === 'visible') {
          try {
              if (localStorage.getItem('needs-refresh-main') === 'true') {
                  localStorage.removeItem('needs-refresh-main');
                  uiToast('Обновление ленты...');
                  fetchCountsAll(state.query);
                  refetchFromZeroSmooth(state.activeKey);
              }
          } catch (error) {
              console.warn('localStorage недоступен:', error);
              // Fallback: просто обновляем без проверки флага
              uiToast('Обновление ленты...');
              fetchCountsAll(state.query);
              refetchFromZeroSmooth(state.activeKey);
          }
      }
  }
  document.addEventListener('visibilitychange', handlePageVisibility);

  // Улучшенная инициализация с проверкой готовности DOM
  function waitForDOM() {
    return new Promise((resolve) => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
      } else {
        resolve();
      }
    });
  }

  // Проверка критических элементов
  function checkCriticalElements() {
    const critical = {
      containers: {
        main: document.getElementById('vacancies-list-main'),
        maybe: document.getElementById('vacancies-list-maybe'),
        other: document.getElementById('vacancies-list-other'),
      },
      counts: {
        main: document.getElementById('count-main'),
        maybe: document.getElementById('count-maybe'),
        other: document.getElementById('count-other'),
      },
      other: {
        searchInput: document.getElementById('search-input'),
        loader: document.getElementById('loader'),
        tabButtons: document.querySelectorAll('.tab-button'),
        vacancyLists: document.querySelectorAll('.vacancy-list'),
      }
    };

    
    // Проверяем контейнеры
    const missingContainers = Object.entries(critical.containers)
      .filter(([key, el]) => !el)
      .map(([key]) => key);
    
    if (missingContainers.length > 0) {
      console.error('❌ Отсутствуют контейнеры:', missingContainers);
      return false;
    }

    // Проверяем счетчики
    const missingCounts = Object.entries(critical.counts)
      .filter(([key, el]) => !el)
      .map(([key]) => key);
    
    if (missingCounts.length > 0) {
      console.error('❌ Отсутствуют счетчики:', missingCounts);
      return false;
    }

    // Проверяем остальные элементы
    const missingOther = Object.entries(critical.other)
      .filter(([key, el]) => !el || (Array.isArray(el) && el.length === 0))
      .map(([key]) => key);
    
    if (missingOther.length > 0) {
      console.error('❌ Отсутствуют элементы:', missingOther);
      return false;
    }

    return true;
  }

  // Основная функция инициализации
  async function mainInit() {
    try {
      
      // Ждем готовности DOM
      await waitForDOM();
      
      // Проверяем критические элементы
      if (!checkCriticalElements()) {
        throw new Error('Критические элементы не найдены');
      }
      
      // Инициализируем приложение
      await init();
      
    } catch (error) {
      console.error('❌ Критическая ошибка инициализации:', error);
      
      // Показываем пользователю ошибку
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ff4444;
        color: white;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
        z-index: 10000;
        max-width: 80%;
      `;
      errorDiv.innerHTML = `
        <h3>Ошибка загрузки приложения</h3>
        <p>${error.message}</p>
        <button onclick="location.reload()" style="
          background: white;
          color: #ff4444;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          margin-top: 10px;
          cursor: pointer;
        ">Перезагрузить</button>
      `;
      document.body.appendChild(errorDiv);
    }
  }

  // Запускаем инициализацию
  mainInit();
})();
