// favorites.js — вкладка «Избранное»

(function () {
  'use strict';

  // Показать skeleton для избранного
  function showFavoritesSkeleton() {
    const container = document.getElementById('favorites-list');
    if (!container) return;

    const skeletonHTML = `
      <div class="skeleton-container">
        <div class="vacancy-card-skeleton">
          <div class="skeleton skeleton-header"></div>
          <div class="skeleton skeleton-text long"></div>
          <div class="skeleton skeleton-text medium"></div>
          <div class="skeleton skeleton-text short"></div>
          <div class="skeleton-footer">
            <div class="skeleton skeleton-tag"></div>
            <div class="skeleton skeleton-meta"></div>
          </div>
        </div>
        <div class="vacancy-card-skeleton">
          <div class="skeleton skeleton-header"></div>
          <div class="skeleton skeleton-text long"></div>
          <div class="skeleton skeleton-text medium"></div>
          <div class="skeleton skeleton-text short"></div>
          <div class="skeleton-footer">
            <div class="skeleton skeleton-tag"></div>
            <div class="skeleton skeleton-meta"></div>
          </div>
        </div>
        <div class="vacancy-card-skeleton">
          <div class="skeleton skeleton-header"></div>
          <div class="skeleton skeleton-text long"></div>
          <div class="skeleton skeleton-text medium"></div>
          <div class="skeleton skeleton-text short"></div>
          <div class="skeleton-footer">
            <div class="skeleton skeleton-tag"></div>
            <div class="skeleton skeleton-meta"></div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = skeletonHTML;
  }

  // Скрыть skeleton
  function hideFavoritesSkeleton() {
    const container = document.getElementById('favorites-list');
    if (!container) return;

    const skeletonContainer = container.querySelector('.skeleton-container');
    if (skeletonContainer) {
      skeletonContainer.classList.add('skeleton-hidden');
      setTimeout(() => {
        if (skeletonContainer.parentNode) {
          skeletonContainer.remove();
        }
      }, 300);
    }
  }

  const CFG  = window.APP_CONFIG;
  const UTIL = window.utils;

  if (!CFG || !UTIL) {
      alert('Критическая ошибка: не удалось загрузить config.js или utils.js');
      return;
  }

  const {
    RETRY_OPTIONS,
    STATUSES
  } = CFG;

  const {
    debounce,
    openLink,
    safeAlert,
    uiToast,
    fetchWithRetry,
    createVacancyCard,
    setupPullToRefresh,
    renderEmptyState,
    renderError,
    showCustomConfirm,
    createSupabaseHeaders,
    highlightText,
    checkRateLimit
  } = UTIL;

  // Haptic Feedback для Telegram WebApp (требует Bot API 6.1+)
  function triggerHaptic(type, style) {
    try {
      const webApp = window.Telegram?.WebApp;
      if (!webApp?.HapticFeedback) return;
      
      // Проверяем версию (HapticFeedback доступен с версии 6.1+)
      const version = parseFloat(webApp.version || '6.0');
      if (version < 6.1) return;
      
      switch (type) {
        case 'impact':
          webApp.HapticFeedback.impactOccurred(style || 'light');
          break;
        case 'notification':
          webApp.HapticFeedback.notificationOccurred(style || 'success');
          break;
        case 'selection':
          webApp.HapticFeedback.selectionChanged();
          break;
      }
    } catch (e) {
      // Тихо игнорируем ошибки - не все версии поддерживают
    }
  }

  const container = document.getElementById('favorites-list');
  const searchInputFav = document.getElementById('favorites-search');
  const searchClearBtnFav = document.getElementById('favorites-search-clear');
  const searchInputWrapperFav = searchInputFav?.parentElement;
  
  // Проверяем критические элементы
  if (!container) {
    console.error('Критическая ошибка: не найден контейнер favorites-list');
    safeAlert('Не удается отобразить избранные вакансии. Перезагрузите страницу.');
    return;
  }
  
  let allFavorites = [];

  let favStatsEl = null;
  function ensureFavSearchUI() {
    const parent = document.getElementById('search-container-fav') || searchInputFav?.parentElement;
    if (!parent || favStatsEl || !searchInputWrapperFav) return;
    favStatsEl = document.createElement('div');
    favStatsEl.className = 'search-stats';
    searchInputWrapperFav.insertAdjacentElement('afterend', favStatsEl);
  }
  function updateFavStats(total, visible, isInitialLoad = false) {
    if (!favStatsEl) return;
    const q = (searchInputFav?.value || '').trim();
    favStatsEl.textContent = q ? (visible===0 ? 'Ничего не найдено' : `Найдено: ${visible} из ${total}`) : '';
    
    // Обновляем счетчик в заголовке
    if (isInitialLoad) {
      animateCounterFromZero(total);
    } else {
      updateFavoritesCount(total);
    }
  }
  
  function updateFavoritesCount(count) {
    const countEl = document.getElementById('favorites-count');
    if (countEl) {
      countEl.textContent = count;
      countEl.classList.add('updating');
      setTimeout(() => countEl.classList.remove('updating'), 200);
    }
  }
  
  function animateCounterFromZero(targetCount) {
    const countEl = document.getElementById('favorites-count');
    if (!countEl || targetCount === 0) {
      updateFavoritesCount(targetCount);
      return;
    }
    
    let currentCount = 0;
    const duration = 800; // Длительность анимации в мс
    const steps = Math.min(targetCount, 20); // Максимум 20 шагов для плавности
    const stepTime = duration / steps;
    const increment = targetCount / steps;
    
    // Начинаем с желтого и плавно переходим к зеленому
    countEl.classList.add('counting-up');
    
    const counter = setInterval(() => {
      currentCount += increment;
      if (currentCount >= targetCount) {
        currentCount = targetCount;
        countEl.textContent = targetCount;
        countEl.classList.remove('counting-up');
        // Переход от зеленого к желтому
        countEl.classList.add('counting-complete');
        setTimeout(() => countEl.classList.remove('counting-complete'), 400);
        clearInterval(counter);
      } else {
        countEl.textContent = Math.floor(currentCount);
      }
    }, stepTime);
  }

  function renderFilteredFavorites(isInitialLoad = false) {
    const query = (searchInputFav?.value || '').trim().toLowerCase();
    
    let visibleCount = 0;
    
    container.querySelectorAll('.vacancy-card').forEach(card => {
        const isVisible = query ? card.dataset.searchText.toLowerCase().includes(query) : true;
        card.style.display = isVisible ? '' : 'none';
        
        if (isVisible) {
            visibleCount++;
            const summaryEl = card.querySelector('.card-summary');
            if (summaryEl && summaryEl.dataset.originalSummary) {
                window.utils.setHighlightedText(summaryEl, summaryEl.dataset.originalSummary, query);
            }
        }
    });

    const emptyEl = container.querySelector('.empty-state');
    if (emptyEl) emptyEl.remove();

    if (allFavorites.length === 0) {
        renderEmptyState(container, '-- В избранном пусто --');
    } else if (visibleCount === 0 && query) {
        const div = document.createElement('div');
        renderEmptyState(div, 'Ничего не найдено по вашему запросу');
        container.prepend(div.firstElementChild);
    }
    
    updateFavStats(allFavorites.length, visibleCount, isInitialLoad);
  }

  async function loadFavorites(query = '') {
    showFavoritesSkeleton();
    try {
      const p = new URLSearchParams();
      p.set('select', '*');
      p.set('status', `eq.${STATUSES.FAVORITE}`);
      p.set('order', 'timestamp.desc');

      const url  = `${CFG.SUPABASE_URL}/rest/v1/vacancies?${p.toString()}`;

      const headers = {
        'apikey': CFG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CFG.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      };
      
      const resp = await fetchWithRetry(url, {
        headers: headers
      }, RETRY_OPTIONS);
      if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);

      allFavorites = await resp.json();
      hideFavoritesSkeleton();

      if (!allFavorites || allFavorites.length === 0) {
        renderEmptyState(container, '-- В избранном пусто --');
      } else {
        const frag = document.createDocumentFragment();
        allFavorites.forEach(v => {
          const card = createVacancyCard(v, { pageType: 'favorites' });
          
          // Убеждаемся, что кнопка favorite существует для свайпов
          let favoriteBtn = card.querySelector('[data-action="favorite"]');
          if (!favoriteBtn) {
            // Создаем кнопку favorite если её нет
            favoriteBtn = document.createElement('button');
            favoriteBtn.className = 'card-action-btn favorite unfavorite';
            favoriteBtn.dataset.action = 'favorite';
            favoriteBtn.dataset.id = v.id;
            favoriteBtn.title = 'Вернуть в основные';
            favoriteBtn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                <path d="M3 3l18 18" stroke-width="2"/>
              </svg>
            `;
            
            // Добавляем кнопку в контейнер действий
            const actionsContainer = card.querySelector('.card-actions') || card.querySelector('.vacancy-card-footer');
            if (actionsContainer) {
              actionsContainer.appendChild(favoriteBtn);
            } else {
              card.appendChild(favoriteBtn);
            }
          }
          
          frag.appendChild(card);
        });
        container.appendChild(frag);
      }
      renderFilteredFavorites(true); // true = первоначальная загрузка
      document.dispatchEvent(new CustomEvent('favorites:loaded'));
    } catch (e) {
      console.error(e);
      hideFavoritesSkeleton();
      renderError(container, 'Ошибка загрузки избранного', () => loadFavorites());
      document.dispatchEvent(new CustomEvent('favorites:loaded'));
    }
  }

  // Предотвращение race conditions в favorites updateStatus
  const updateStatusLocksFav = new Set();
  
  async function returnToMain(vacancyId) {
    // Проверяем блокировку
    if (updateStatusLocksFav.has(vacancyId)) {
      console.log('returnToMain уже выполняется для ID:', vacancyId);
      return;
    }

    // Проверяем rate limit
    const rateResult = await checkRateLimit('favorite');
    if (!rateResult.allowed) {
      uiToast(rateResult.message);
      return;
    }
    
    // Блокируем операцию
    updateStatusLocksFav.add(vacancyId);
    
    try {
      const cardElement = document.getElementById(`card-${vacancyId}`);
      if (!cardElement) {
        updateStatusLocksFav.delete(vacancyId);
        return;
      }

      // Анимация скрытия
      cardElement.style.transition = 'opacity .3s, max-height .3s, margin .3s, padding .3s, border-width .3s';
      cardElement.style.opacity = '0';
      cardElement.style.maxHeight = '0px';
      cardElement.style.paddingTop = '0';
      cardElement.style.paddingBottom = '0';
      cardElement.style.marginTop = '0';
      cardElement.style.marginBottom = '0';
      cardElement.style.borderWidth = '0';

      const onUndo = () => {
          // Убираем все свайп-классы чтобы карточка не была залитой
          cardElement.classList.remove('swipe-left', 'swipe-right');
          
          // Принудительно убираем любые overlays
          const overlays = cardElement.querySelectorAll('.swipe-action-overlay');
          overlays.forEach(overlay => {
            overlay.classList.remove('visible');
            overlay.style.opacity = '0';
          });
          
          cardElement.style.transition = 'opacity .3s, transform .3s, max-height .3s, margin .3s, padding .3s, border-width .3s';
          cardElement.style.opacity = '1';
          cardElement.style.transform = 'scale(1)';
          cardElement.style.maxHeight = '500px';
          cardElement.style.paddingTop = '';
          cardElement.style.paddingBottom = '';
          cardElement.style.marginTop = '';
          cardElement.style.marginBottom = '';
          cardElement.style.borderWidth = '';
          
          // Сбрасываем также стили background если они остались
          cardElement.style.background = '';
          cardElement.style.backgroundColor = '';
          cardElement.style.removeProperty('background');
          cardElement.style.removeProperty('background-color');
          
          // Убираем transition после анимации
          setTimeout(() => {
            cardElement.style.transition = '';
          }, 300);
      };

      // Haptic feedback для возврата в основные
      triggerHaptic('notification', 'success');
      
      uiToast('Возвращено в основной список', {
          timeout: 5000,
          onUndo: () => {
            // Убираем все свайп-классы чтобы карточка не была залитой
            cardElement.classList.remove('swipe-left', 'swipe-right');
            
            // Принудительно убираем любые overlays
            const overlays = cardElement.querySelectorAll('.swipe-action-overlay');
            overlays.forEach(overlay => {
              overlay.classList.remove('visible');
              overlay.style.opacity = '0';
            });
            
            cardElement.style.transition = 'opacity .3s, transform .3s, max-height .3s, margin .3s, padding .3s, border-width .3s';
            cardElement.style.opacity = '1';
            cardElement.style.transform = 'scale(1)';
            cardElement.style.maxHeight = '500px';
            cardElement.style.paddingTop = '';
            cardElement.style.paddingBottom = '';
            cardElement.style.marginTop = '';
            cardElement.style.marginBottom = '';
            cardElement.style.borderWidth = '';
            
            // Сбрасываем также стили background если они остались
            cardElement.style.background = '';
            cardElement.style.backgroundColor = '';
            cardElement.style.removeProperty('background');
            cardElement.style.removeProperty('background-color');
            
            // Убираем transition после анимации
            setTimeout(() => {
              cardElement.style.transition = '';
            }, 300);
          },
          onTimeout: async () => {
              try {
                // Мгновенно обновляем счетчик при удалении
                const currentCount = container.querySelectorAll('.vacancy-card').length - 1;
                updateFavoritesCount(currentCount > 0 ? currentCount : 0);
                
                cardElement.remove();
                const url = `${CFG.SUPABASE_URL}/rest/v1/vacancies?id=eq.${encodeURIComponent(vacancyId)}`;
                const resp = await fetchWithRetry(url, {
                  method: 'PATCH',
                  headers: createSupabaseHeaders({ prefer: 'return=minimal' }),
                  body: JSON.stringify({ status: STATUSES.NEW })
                }, RETRY_OPTIONS);

                if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
                
                try {
                    localStorage.setItem('needs-refresh-main', 'true');
                } catch (storageError) {
                    console.warn('localStorage недоступен:', storageError);
                }
                allFavorites = allFavorites.filter(v => v.id !== vacancyId);
                renderFilteredFavorites();
              } catch (e) {
                safeAlert('Не удалось изменить статус.');
                onUndo();
              }
          }
      });
    } catch (error) {
      console.error('Ошибка в favorites returnToMain:', error);
      triggerHaptic('notification', 'error');
      safeAlert('Произошла ошибка при обновлении статуса');
    } finally {
      updateStatusLocksFav.delete(vacancyId);
    }
  }
  
  async function updateStatus(vacancyId, newStatus) {
    // Проверяем блокировку - предотвращает двойные клики
    if (updateStatusLocksFav.has(vacancyId)) {
      console.log('updateStatus уже выполняется для ID:', vacancyId);
      return;
    }

    // Проверяем rate limit для удаления из избранного
    const rateResult = await checkRateLimit('favorite');
    if (!rateResult.allowed) {
      uiToast(rateResult.message);
      return;
    }
    
    // Блокируем операцию
    updateStatusLocksFav.add(vacancyId);
    
    try {
      const cardElement = document.getElementById(`card-${vacancyId}`);
      if (!cardElement) {
        updateStatusLocksFav.delete(vacancyId);
        return;
      }

      // Анимация скрытия
      cardElement.style.transition = 'opacity .3s, max-height .3s, margin .3s, padding .3s, border-width .3s';
      cardElement.style.opacity = '0';
      cardElement.style.maxHeight = '0px';
      cardElement.style.paddingTop = '0';
      cardElement.style.paddingBottom = '0';
      cardElement.style.marginTop = '0';
      cardElement.style.marginBottom = '0';
      cardElement.style.borderWidth = '0';

      // Haptic feedback для удаления
      triggerHaptic('impact', 'medium');
      
      uiToast('Вакансия удалена', {
          timeout: 5000,
          onUndo: () => {
            // Убираем все свайп-классы чтобы карточка не была залитой
            cardElement.classList.remove('swipe-left', 'swipe-right');
            
            // Принудительно убираем любые overlays
            const overlays = cardElement.querySelectorAll('.swipe-action-overlay');
            overlays.forEach(overlay => {
              overlay.classList.remove('visible');
              overlay.style.opacity = '0';
            });
            
            cardElement.style.transition = 'opacity .3s, transform .3s, max-height .3s, margin .3s, padding .3s, border-width .3s';
            cardElement.style.opacity = '1';
            cardElement.style.transform = 'scale(1)';
            cardElement.style.maxHeight = '500px';
            cardElement.style.paddingTop = '';
            cardElement.style.paddingBottom = '';
            cardElement.style.marginTop = '';
            cardElement.style.marginBottom = '';
            cardElement.style.borderWidth = '';
            
            // Сбрасываем также стили background если они остались
            cardElement.style.background = '';
            cardElement.style.backgroundColor = '';
            cardElement.style.removeProperty('background');
            cardElement.style.removeProperty('background-color');
            
            // Убираем transition после анимации
            setTimeout(() => {
              cardElement.style.transition = '';
            }, 300);
          },
          onTimeout: async () => {
              try {
                // Мгновенно обновляем счетчик при удалении
                const currentCount = container.querySelectorAll('.vacancy-card').length - 1;
                updateFavoritesCount(currentCount > 0 ? currentCount : 0);
                
                cardElement.remove();
                const url = `${CFG.SUPABASE_URL}/rest/v1/vacancies?id=eq.${encodeURIComponent(vacancyId)}`;
                const resp = await fetchWithRetry(url, {
                  method: 'PATCH',
                  headers: {
                    'apikey': CFG.SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${CFG.SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                  },
                  body: JSON.stringify({ status: newStatus })
                }, RETRY_OPTIONS);

                if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
                
                try {
                    localStorage.setItem('needs-refresh-main', 'true');
                } catch (storageError) {
                    console.warn('localStorage недоступен:', storageError);
                    // Продолжаем работу без localStorage
                }
                allFavorites = allFavorites.filter(v => v.id !== vacancyId);
                renderFilteredFavorites();
              } catch (e) {
                safeAlert('Не удалось изменить статус.');
                onUndo();
              }
          }
      });
    } catch (error) {
      console.error('Ошибка в favorites updateStatus:', error);
      triggerHaptic('notification', 'error');
      safeAlert('Произошла ошибка при обновлении статуса');
    } finally {
      // Всегда снимаем блокировку
      updateStatusLocksFav.delete(vacancyId);
    }
  }

  container?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'apply')   openLink(btn.dataset.url);
    if (action === 'delete')  updateStatus(btn.dataset.id, STATUSES.NEW);
    if (action === 'favorite') returnToMain(btn.dataset.id); // Возврат в основные
  });

  const onSearch = debounce(() => renderFilteredFavorites(), 200);
  
  searchInputFav?.addEventListener('input', () => {
      searchInputWrapperFav?.classList.toggle('has-text', searchInputFav.value.length > 0);
      onSearch();
  });
  searchClearBtnFav?.addEventListener('click', () => {
      if (searchInputFav) {
        searchInputFav.value = '';
        searchInputWrapperFav?.classList.remove('has-text');
        onSearch();
        searchInputFav.focus();
      }
  });
  
  setupPullToRefresh({
      onRefresh: () => loadFavorites(),
      refreshEventName: 'favorites:loaded'
  });

  // Инициализируем свайпы для избранного
  document.addEventListener('favorites:loaded', () => {
    if (window.SwipeHandler) {
      window.SwipeHandler.initForNewCards();
    }
  });

  // Показываем skeleton при инициализации страницы
  document.addEventListener('DOMContentLoaded', function() {
    ensureFavSearchUI();
    loadFavorites();
  });
})();
