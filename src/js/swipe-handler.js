// Swipe Handler для карточек вакансий
(function() {
    'use strict';

    let isInitialized = false;

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

    function initSwipeHandler() {
        if (typeof interact === 'undefined') {
            console.warn('interact.js не загружен');
            return;
        }

        const cards = document.querySelectorAll('.vacancy-card');
        
        if (cards.length === 0) {
            setTimeout(() => initSwipeHandler(), 1000);
            return;
        }

        if (isInitialized) return;
        isInitialized = true;

        interact('.vacancy-card').draggable({
            allowFrom: '.vacancy-card',
            ignoreFrom: 'button, a, input, .summary, .info-value, .full-text',
            // Менее строгие ограничения для плавности на больших экранах
            startAxis: 'xy',
            lockAxis: 'start',
            // Уменьшаем порог для плавности
            threshold: 8,
            listeners: {
                start(event) {
                    // Убираем остаточную анимацию от предыдущего свайпа
                    event.target.style.transition = 'none';
                    // Добавляем класс для активации touch-action: none
                    event.target.classList.add('swiping');
                    event.target.style.zIndex = '100';
                    // Легкая тактильная отдача при начале свайпа
                    triggerHaptic('selection');
                },
                move(event) {
                    const dx = event.pageX - event.x0;
                    const dy = event.pageY - event.y0;
                    const absX = Math.abs(dx);
                    const absY = Math.abs(dy);
                    const deleteOverlay = event.target.querySelector('.swipe-action-overlay.delete');
                    const favoriteOverlay = event.target.querySelector('.swipe-action-overlay.favorite');
                    const unfavoriteOverlay = event.target.querySelector('.swipe-action-overlay.unfavorite');

                    // Проверяем, находимся ли мы на странице избранного
                    const isOnFavoritesPage = window.location.pathname.includes('favorites.html') || 
                                            document.querySelector('#favorites-list') !== null;

                    // Плавное ограничение с затуханием - увеличиваем для комфорта
                    const maxMove = 160;
                    const resistance = 0.8;
                    let limitedDx;
                    
                    if (absX <= maxMove) {
                        limitedDx = dx;
                    } else {
                        const excess = absX - maxMove;
                        const resistedExcess = excess * resistance;
                        limitedDx = dx > 0 ? maxMove + resistedExcess : -(maxMove + resistedExcess);
                    }

                    // Плавная анимация движения с улучшенной производительностью
                    event.target.style.transform = `translate3d(${limitedDx}px, 0, 0)`;

                    // Показываем overlays при движении > 60px для четкого визуала
                    if (absX > 60) {
                        if (dx < 0) {
                            // Свайп влево - всегда удаление
                            event.target.classList.add('swipe-left');
                            event.target.classList.remove('swipe-right');
                            if (deleteOverlay) deleteOverlay.classList.add('visible');
                            if (favoriteOverlay) favoriteOverlay.classList.remove('visible');
                            if (unfavoriteOverlay) unfavoriteOverlay.classList.remove('visible');
                        } else {
                            // Свайп вправо - зависит от страницы
                            event.target.classList.add('swipe-right');
                            event.target.classList.remove('swipe-left');
                            if (deleteOverlay) deleteOverlay.classList.remove('visible');
                            
                            if (isOnFavoritesPage) {
                                // На странице избранного - убрать из избранного
                                if (unfavoriteOverlay) unfavoriteOverlay.classList.add('visible');
                                if (favoriteOverlay) favoriteOverlay.classList.remove('visible');
                            } else {
                                // На главной странице - добавить в избранное
                                if (favoriteOverlay) favoriteOverlay.classList.add('visible');
                                if (unfavoriteOverlay) unfavoriteOverlay.classList.remove('visible');
                            }
                        }
                    } else {
                        // Скрываем все overlays
                        event.target.classList.remove('swipe-left', 'swipe-right');
                        if (deleteOverlay) deleteOverlay.classList.remove('visible');
                        if (favoriteOverlay) favoriteOverlay.classList.remove('visible');
                        if (unfavoriteOverlay) unfavoriteOverlay.classList.remove('visible');
                    }
                },
                end(event) {
                    const card = event.target;
                    const dx = event.pageX - event.x0;
                    const absX = Math.abs(dx);
                    const deleteBtn = card.querySelector('[data-action="delete"]');
                    const favoriteBtn = card.querySelector('[data-action="favorite"]');
                    const deleteOverlay = card.querySelector('.swipe-action-overlay.delete');
                    const favoriteOverlay = card.querySelector('.swipe-action-overlay.favorite');
                    const unfavoriteOverlay = card.querySelector('.swipe-action-overlay.unfavorite');

                    // Проверяем, находимся ли мы на странице избранного
                    const isOnFavoritesPage = window.location.pathname.includes('favorites.html') || 
                                            document.querySelector('#favorites-list') !== null;

                    // CSS touch-action автоматически восстанавливается при удалении класса .swiping

                    // Убираем классы и overlays
                    card.classList.remove('swiping', 'swipe-left', 'swipe-right');
                    if (deleteOverlay) deleteOverlay.classList.remove('visible');
                    if (favoriteOverlay) favoriteOverlay.classList.remove('visible');
                    if (unfavoriteOverlay) unfavoriteOverlay.classList.remove('visible');
                    card.style.zIndex = '';

                    // Определяем действие ТОЛЬКО после отпускания пальца
                    const isQuickSwipe = event.speed && event.speed > 0.5;
                    const threshold = isQuickSwipe ? 70 : 90;
                    
                    if (absX > threshold) {
                        if (dx < 0 && deleteBtn) {
                            // Свайп влево - всегда удаление
                            if (deleteOverlay) deleteOverlay.classList.add('visible');
                            card.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';
                            card.style.transform = 'translate3d(-100%, 0, 0)';
                            card.style.opacity = '0';
                            // Средний удар при удалении
                            triggerHaptic('impact', 'medium');
                            // Вызываем updateVacancyStatus с флагом isFromSwipe для поддержки отмены
                            setTimeout(() => {
                                console.log('🗑️ Свайп влево - удаление вакансии:', deleteBtn.dataset.id);
                                if (window.vacancyManager && window.vacancyManager.updateVacancyStatus) {
                                    console.log('✅ Вызываем vacancyManager.updateVacancyStatus с isFromSwipe=true');
                                    window.vacancyManager.updateVacancyStatus(deleteBtn.dataset.id, 'deleted', true);
                                } else {
                                    console.log('⚠️ vacancyManager недоступен, используем fallback');
                                    deleteBtn.click();
                                }
                            }, 400);
                        } else if (dx > 0) {
                            // Свайп вправо - зависит от страницы
                            if (isOnFavoritesPage && favoriteBtn) {
                                // На странице избранного - убрать из избранного (возврат в основные)
                                if (unfavoriteOverlay) unfavoriteOverlay.classList.add('visible');
                                card.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';
                                card.style.transform = 'translate3d(100%, 0, 0)';
                                card.style.opacity = '0';
                                // Успешное уведомление при возврате в основные
                                triggerHaptic('notification', 'success');
                                setTimeout(() => favoriteBtn.click(), 400); // На странице избранного кнопка favorite возвращает в основные
                            } else if (!isOnFavoritesPage && favoriteBtn) {
                                // На главной странице - добавить в избранное
                                if (favoriteOverlay) favoriteOverlay.classList.add('visible');
                                card.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';
                                card.style.transform = 'translate3d(100%, 0, 0)';
                                card.style.opacity = '0';
                                // Успешное уведомление при добавлении в избранное
                                triggerHaptic('notification', 'success');
                                // Вызываем updateVacancyStatus с флагом isFromSwipe для поддержки отмены
                                setTimeout(() => {
                                    console.log('❤️ Свайп вправо - добавление в избранное:', favoriteBtn.dataset.id);
                                    if (window.vacancyManager && window.vacancyManager.updateVacancyStatus) {
                                        console.log('✅ Вызываем vacancyManager.updateVacancyStatus с isFromSwipe=true');
                                        window.vacancyManager.updateVacancyStatus(favoriteBtn.dataset.id, 'favorite', true);
                                    } else {
                                        console.log('⚠️ vacancyManager недоступен, используем fallback');
                                        favoriteBtn.click();
                                    }
                                }, 400);
                            } else {
                                // Возврат на место если нет подходящей кнопки
                                card.style.transition = 'transform 0.3s ease-out';
                                card.style.transform = 'translate3d(0, 0, 0)';
                            }
                        } else {
                            // Возврат на место с аппаратным ускорением
                            card.style.transition = 'transform 0.3s ease-out';
                            card.style.transform = 'translate3d(0, 0, 0)';
                        }
                    } else {
                        // Возврат на место с аппаратным ускорением
                        card.style.transition = 'transform 0.3s ease-out';
                        card.style.transform = 'translate3d(0, 0, 0)';
                    }
                }
            }
        });

        // Сброс при скрытии страницы
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                document.querySelectorAll('.vacancy-card.swiping').forEach(card => {
                    card.classList.remove('swiping', 'swipe-left', 'swipe-right');
                    card.style.transform = 'translate3d(0, 0, 0)';
                    card.style.zIndex = '';
                });
            }
        });
    }

    // Добавляем overlay для действий свайпов
    function addSwipeOverlays() {
        document.querySelectorAll('.vacancy-card').forEach(card => {
            // Проверяем, есть ли уже overlays
            if (card.querySelector('.swipe-action-overlay')) return;

            // Overlay для удаления (свайп влево)
            const deleteOverlay = document.createElement('div');
            deleteOverlay.className = 'swipe-action-overlay delete';
            const deleteIcon = document.createElement('div');
            deleteIcon.className = 'pixel-icon delete';
            deleteOverlay.appendChild(deleteIcon);
            card.appendChild(deleteOverlay);

            // Overlay для избранного (свайп вправо на главной странице)
            const favoriteOverlay = document.createElement('div');
            favoriteOverlay.className = 'swipe-action-overlay favorite';
            const favoriteIcon = document.createElement('div');
            favoriteIcon.className = 'pixel-icon favorite';
            favoriteOverlay.appendChild(favoriteIcon);
            card.appendChild(favoriteOverlay);

            // Overlay для убрать из избранного (свайп вправо на странице избранного)
            const unfavoriteOverlay = document.createElement('div');
            unfavoriteOverlay.className = 'swipe-action-overlay unfavorite';
            const unfavoriteIcon = document.createElement('div');
            unfavoriteIcon.className = 'pixel-icon unfavorite';
            unfavoriteOverlay.appendChild(unfavoriteIcon);
            card.appendChild(unfavoriteOverlay);
        });
    }

    function initForNewCards() {
        if (typeof interact === 'undefined') return;
        addSwipeOverlays();
        
        // Принудительная реинициализация для обновленных карточек
        // Это нужно для вкладок где могли остаться старые настройки
        interact('.vacancy-card').unset();
        isInitialized = false;
        initSwipeHandler();
    }

    function setupSwipes() {
        // Настройка для Telegram WebApp версии 6.0
        if (window.Telegram?.WebApp) {
            try {
                window.Telegram.WebApp.expand();
                // Проверяем версию перед использованием новых функций
                const version = parseFloat(window.Telegram.WebApp.version || '6.0');
                
                // setHeaderColor доступен с версии 6.1+
                if (version >= 6.1 && window.Telegram.WebApp.setHeaderColor) {
                    window.Telegram.WebApp.setHeaderColor('#F0F0F0');
                }
                
                // disableVerticalSwipes доступен с версии 6.9+
                if (version >= 6.9 && window.Telegram.WebApp.disableVerticalSwipes) {
                    window.Telegram.WebApp.disableVerticalSwipes();
                }
            } catch (e) {
                console.debug('Telegram WebApp API error:', e.message);
            }
        }

        // CSS touch-action обеспечивает всю необходимую блокировку
        
        initSwipeHandler();
        addSwipeOverlays();
        
        const observer = new MutationObserver(() => {
            addSwipeOverlays();
            initForNewCards();
        });
        
        // Наблюдаем за изменениями в списках вакансий
        const listsToObserve = [
            ...document.querySelectorAll('.vacancy-list'),
            document.getElementById('favorites-list'),
            document.getElementById('vacancies-list')
        ].filter(Boolean);
        
        listsToObserve.forEach(list => {
            observer.observe(list, { childList: true, subtree: true });
        });
    }

    function init() {
        if (typeof interact !== 'undefined') {
            setupSwipes();
        }
    }

    // Запускаем после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.addEventListener('interactLoaded', () => {
        if (typeof interact !== 'undefined') {
            setupSwipes();
        }
    });

    // Функция для сброса и переинициализации (нужна при возврате на страницу)
    function reinitialize() {
        console.log('🔄 Переинициализация SwipeHandler');
        isInitialized = false; // Сбрасываем флаг
        
        // Удаляем старые interact обработчики если есть
        if (typeof interact !== 'undefined') {
            interact('.vacancy-card').unset();
        }
        
        // Переинициализируем
        initSwipeHandler();
        addSwipeOverlays();
        initForNewCards();
        
        console.log('✅ SwipeHandler переинициализирован');
    }

    // Экспортируем функции для использования в других модулях
    window.SwipeHandler = {
        init: initSwipeHandler,
        addOverlays: addSwipeOverlays,
        initForNewCards: initForNewCards,
        reinitialize: reinitialize
    };
})();