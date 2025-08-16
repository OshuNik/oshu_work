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
                    
                    // Дополнительная защита от сворачивания при мало вакансиях
                    if (window.Telegram?.WebApp) {
                        try {
                            window.Telegram.WebApp.disableVerticalSwipes();
                            window.Telegram.WebApp.expand();
                        } catch (e) {}
                    }
                    
                    // Блокируем все системные жесты во время свайпа
                    document.body.style.overscrollBehavior = 'none';
                    document.documentElement.style.overscrollBehavior = 'none';
                    document.body.style.position = 'fixed';
                    document.body.style.width = '100%';
                    
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

                    // Блокируем PTR только при реальном горизонтальном движении
                    if (absX > 15 && absX > absY * 1.5) {
                        // Предотвращаем PTR и системные жесты только при четком горизонтальном свайпе
                        try {
                            event.preventDefault();
                            if (event.originalEvent) {
                                event.originalEvent.preventDefault();
                                event.originalEvent.stopPropagation();
                            }
                        } catch (e) {}
                        
                        // Дополнительная блокировка через CSS
                        document.body.style.touchAction = 'none';
                        document.body.style.userSelect = 'none';
                    }

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

                    // Восстанавливаем CSS свойства
                    document.body.style.overscrollBehavior = '';
                    document.documentElement.style.overscrollBehavior = '';
                    document.body.style.touchAction = '';
                    document.body.style.userSelect = '';
                    document.body.style.position = '';
                    document.body.style.width = '';

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
                            // Плавная анимация удаления без дерганья
                            card.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out, height 0.3s ease-out 0.2s, margin 0.3s ease-out 0.2s, padding 0.3s ease-out 0.2s';
                            card.style.transform = 'translateX(-100%)';
                            card.style.opacity = '0';
                            // Плавное схлопывание высоты для уменьшения дерганья
                            setTimeout(() => {
                                card.style.height = '0';
                                card.style.margin = '0';
                                card.style.padding = '0';
                                card.style.overflow = 'hidden';
                            }, 200);
                            setTimeout(() => deleteBtn.click(), 500);
                        } else if (dx > 0 && favoriteBtn) {
                            // Плавная анимация добавления в избранное
                            card.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out, height 0.3s ease-out 0.2s, margin 0.3s ease-out 0.2s, padding 0.3s ease-out 0.2s';
                            card.style.transform = 'translateX(100%)';
                            card.style.opacity = '0';
                            setTimeout(() => {
                                card.style.height = '0';
                                card.style.margin = '0';
                                card.style.padding = '0';
                                card.style.overflow = 'hidden';
                            }, 200);
                            setTimeout(() => favoriteBtn.click(), 500);
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
        // Отключаем вертикальные свайпы Telegram для предотвращения сворачивания
        if (window.Telegram?.WebApp) {
            try {
                window.Telegram.WebApp.disableVerticalSwipes();
                window.Telegram.WebApp.expand();
            } catch (e) {
                // Fallback через postEvent для старых версий
                if (window.TelegramWebviewProxy?.postEvent) {
                    window.TelegramWebviewProxy.postEvent('web_app_setup_swipe_behavior', {
                        allow_vertical_swipe: false
                    });
                    window.TelegramWebviewProxy.postEvent('web_app_expand', null);
                }
            }
        }

        // Дополнительная защита от сворачивания на краях
        document.body.style.position = 'relative';
        document.body.style.overflow = 'hidden auto';
        document.documentElement.style.overflow = 'hidden auto';
        
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