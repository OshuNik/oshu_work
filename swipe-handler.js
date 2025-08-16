// Swipe Handler для карточек вакансий
(function() {
    'use strict';

    let isInitialized = false;

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
            ignoreFrom: 'button, a, input',
            // Менее строгие ограничения для естественного свайпа
            startAxis: 'xy',
            lockAxis: 'start',
            // Уменьшаем порог для лучшей отзывчивости
            threshold: 10,
            listeners: {
                start(event) {
                    event.target.classList.add('swiping');
                    event.target.style.zIndex = '100';
                    
                    // Дополнительная защита от сворачивания для старых версий Telegram
                    if (window.Telegram?.WebApp) {
                        try {
                            // Только expand для версии 6.0
                            window.Telegram.WebApp.expand();
                        } catch (e) {}
                    }
                    
                    // Полная блокировка скролла и вертикального движения
                    document.body.style.overscrollBehavior = 'none';
                    document.documentElement.style.overscrollBehavior = 'none';
                    document.body.style.overflow = 'hidden';
                    document.documentElement.style.overflow = 'hidden';
                    
                    // Сохраняем текущую позицию скролла
                    event.target._savedScrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    
                    // Сохраняем начальную позицию для точного определения направления
                    event.target._swipeStartX = event.pageX;
                    event.target._swipeStartY = event.pageY;
                },
                move(event) {
                    const dx = event.pageX - event.x0;
                    const dy = event.pageY - event.y0;
                    const absX = Math.abs(dx);
                    const absY = Math.abs(dy);
                    const leftIcon = event.target.querySelector('.swipe-icon.left');
                    const rightIcon = event.target.querySelector('.swipe-icon.right');

                    // Агрессивная блокировка всех touch событий при любом движении
                    try {
                        event.preventDefault();
                        if (event.originalEvent) {
                            event.originalEvent.preventDefault();
                            event.originalEvent.stopPropagation();
                        }
                    } catch (e) {}
                    
                    // Полная блокировка PTR и других жестов
                    document.body.style.touchAction = 'none';
                    document.body.style.userSelect = 'none';

                    // Плавное ограничение с затуханием
                    const maxMove = 140;
                    const resistance = 0.7;
                    let limitedDx;
                    
                    if (absX <= maxMove) {
                        limitedDx = dx;
                    } else {
                        const excess = absX - maxMove;
                        const resistedExcess = excess * resistance;
                        limitedDx = dx > 0 ? maxMove + resistedExcess : -(maxMove + resistedExcess);
                    }

                    // Плавная анимация движения
                    event.target.style.transform = `translateX(${limitedDx}px)`;

                    // Показываем индикаторы при движении > 50px (раньше)
                    if (absX > 50) {
                        if (dx < 0) {
                            event.target.classList.add('swipe-left');
                            event.target.classList.remove('swipe-right');
                            if (leftIcon) leftIcon.classList.add('visible');
                            if (rightIcon) rightIcon.classList.remove('visible');
                        } else {
                            event.target.classList.add('swipe-right');
                            event.target.classList.remove('swipe-left');
                            if (rightIcon) rightIcon.classList.add('visible');
                            if (leftIcon) leftIcon.classList.remove('visible');
                        }
                    } else {
                        event.target.classList.remove('swipe-left', 'swipe-right');
                        if (leftIcon) leftIcon.classList.remove('visible');
                        if (rightIcon) rightIcon.classList.remove('visible');
                    }
                },
                end(event) {
                    const card = event.target;
                    const dx = event.pageX - event.x0;
                    const absX = Math.abs(dx);
                    const deleteBtn = card.querySelector('[data-action="delete"]');
                    const favoriteBtn = card.querySelector('[data-action="favorite"]');

                    // Восстанавливаем CSS свойства и скролл
                    document.body.style.overscrollBehavior = '';
                    document.documentElement.style.overscrollBehavior = '';
                    document.body.style.touchAction = '';
                    document.body.style.userSelect = '';
                    document.body.style.overflow = '';
                    document.documentElement.style.overflow = '';
                    
                    // Восстанавливаем позицию скролла
                    if (typeof card._savedScrollTop === 'number') {
                        window.scrollTo(0, card._savedScrollTop);
                        delete card._savedScrollTop;
                    }

                    // Убираем классы
                    card.classList.remove('swiping', 'swipe-left', 'swipe-right');
                    const leftIcon = card.querySelector('.swipe-icon.left');
                    const rightIcon = card.querySelector('.swipe-icon.right');
                    if (leftIcon) leftIcon.classList.remove('visible');
                    if (rightIcon) rightIcon.classList.remove('visible');
                    card.style.zIndex = '';

                    // Учитываем скорость для быстрых свайпов - снижаем порог до 70px
                    const isQuickSwipe = event.speed && event.speed > 0.5;
                    const threshold = isQuickSwipe ? 70 : 90;
                    
                    if (absX > threshold) {
                        if (dx < 0 && deleteBtn) {
                            // Простая анимация удаления
                            card.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';
                            card.style.transform = 'translateX(-100%)';
                            card.style.opacity = '0';
                            setTimeout(() => deleteBtn.click(), 400);
                        } else if (dx > 0 && favoriteBtn) {
                            // Простая анимация добавления в избранное
                            card.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';
                            card.style.transform = 'translateX(100%)';
                            card.style.opacity = '0';
                            setTimeout(() => favoriteBtn.click(), 400);
                        } else {
                            // Плавный возврат на место
                            card.style.transition = 'transform 0.3s ease-out';
                            card.style.transform = 'translateX(0px)';
                        }
                    } else {
                        // Плавный возврат на место
                        card.style.transition = 'transform 0.3s ease-out';
                        card.style.transform = 'translateX(0px)';
                    }
                }
            }
        });

        // Сброс при скрытии страницы
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                document.querySelectorAll('.vacancy-card.swiping').forEach(card => {
                    // Восстанавливаем все CSS свойства
                    document.body.style.overscrollBehavior = '';
                    document.documentElement.style.overscrollBehavior = '';
                    document.body.style.touchAction = '';
                    document.body.style.userSelect = '';
                    document.body.style.overflow = '';
                    document.documentElement.style.overflow = '';
                    
                    // Восстанавливаем позицию скролла
                    if (typeof card._savedScrollTop === 'number') {
                        window.scrollTo(0, card._savedScrollTop);
                        delete card._savedScrollTop;
                    }
                    
                    card.classList.remove('swiping', 'swipe-left', 'swipe-right');
                    card.style.transform = 'translateX(0px)';
                    card.style.zIndex = '';
                });
            }
        });
    }

    // Добавляем иконки к карточкам
    function addSwipeIcons() {
        document.querySelectorAll('.vacancy-card').forEach(card => {
            // Проверяем, есть ли уже иконки
            if (card.querySelector('.swipe-icon')) return;

            // Левая иконка (удалить)
            const leftIcon = document.createElement('div');
            leftIcon.className = 'swipe-icon left';
            leftIcon.textContent = '✕';
            card.appendChild(leftIcon);

            // Правая иконка (избранное)
            const rightIcon = document.createElement('div');
            rightIcon.className = 'swipe-icon right';
            rightIcon.textContent = '★';
            card.appendChild(rightIcon);
        });
    }

    function initForNewCards() {
        if (typeof interact === 'undefined') return;
        addSwipeIcons();
        
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
            } catch (e) {}
        }

        // Дополнительная защита от сворачивания на краях
        document.body.style.position = 'relative';
        document.body.style.overflow = 'hidden auto';
        document.documentElement.style.overflow = 'hidden auto';
        
        // Глобальный блокировщик вертикальных жестов во время свайпа
        let isSwipeActive = false;
        
        // Отслеживаем активные свайпы
        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest('.vacancy-card');
            if (target && target.classList.contains('swiping')) {
                isSwipeActive = true;
            }
        }, true);
        
        document.addEventListener('touchmove', (e) => {
            if (isSwipeActive) {
                try {
                    e.preventDefault();
                    e.stopPropagation();
                } catch (err) {}
            }
        }, { passive: false, capture: true });
        
        document.addEventListener('touchend', () => {
            isSwipeActive = false;
        }, true);
        
        initSwipeHandler();
        addSwipeIcons();
        
        const observer = new MutationObserver(() => {
            addSwipeIcons();
            initForNewCards();
        });
        
        document.querySelectorAll('.vacancy-list').forEach(list => {
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

    // Экспортируем функции для использования в других модулях
    window.SwipeHandler = {
        init: initSwipeHandler,
        addIcons: addSwipeIcons,
        initForNewCards: initForNewCards
    };
})();