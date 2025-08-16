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
                    
                    // Предотвращаем системные жесты при горизонтальном движении
                    if (event.originalEvent) {
                        try {
                            event.originalEvent.preventDefault();
                        } catch (e) {}
                    }
                },
                move(event) {
                    const dx = event.pageX - event.x0;
                    const absX = Math.abs(dx);
                    const leftIcon = event.target.querySelector('.swipe-icon.left');
                    const rightIcon = event.target.querySelector('.swipe-icon.right');

                    // Предотвращаем вертикальную прокрутку во время свайпа
                    if (absX > 10 && event.originalEvent) {
                        try {
                            event.originalEvent.preventDefault();
                        } catch (e) {}
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

                    // Убираем классы
                    card.classList.remove('swiping', 'swipe-left', 'swipe-right');
                    const leftIcon = card.querySelector('.swipe-icon.left');
                    const rightIcon = card.querySelector('.swipe-icon.right');
                    if (leftIcon) leftIcon.classList.remove('visible');
                    if (rightIcon) rightIcon.classList.remove('visible');
                    card.style.zIndex = '';

                    // Порог срабатывания 100px для удобства
                    if (absX > 100) {
                        if (dx < 0 && deleteBtn) {
                            // Медленная анимация удаления
                            card.style.transition = 'transform 0.5s ease-out, opacity 0.5s ease-out';
                            card.style.transform = 'translateX(-100%)';
                            card.style.opacity = '0';
                            setTimeout(() => deleteBtn.click(), 500);
                        } else if (dx > 0 && favoriteBtn) {
                            // Медленная анимация добавления в избранное
                            card.style.transition = 'transform 0.5s ease-out, opacity 0.5s ease-out';
                            card.style.transform = 'translateX(100%)';
                            card.style.opacity = '0';
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
    }

    function setupSwipes() {
        // Отключаем вертикальные свайпы Telegram для предотвращения сворачивания
        if (window.Telegram?.WebApp) {
            try {
                window.Telegram.WebApp.disableVerticalSwipes();
            } catch (e) {
                // Fallback через postEvent для старых версий
                if (window.TelegramWebviewProxy?.postEvent) {
                    window.TelegramWebviewProxy.postEvent('web_app_setup_swipe_behavior', {
                        allow_vertical_swipe: false
                    });
                }
            }
        }
        
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