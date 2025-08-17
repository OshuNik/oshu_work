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
            ignoreFrom: 'button, a, input, .summary, .info-value, .full-text',
            // Менее строгие ограничения для плавности на больших экранах
            startAxis: 'xy',
            lockAxis: 'start',
            // Уменьшаем порог для плавности
            threshold: 8,
            listeners: {
                start(event) {
                    // Добавляем класс для активации touch-action: none
                    event.target.classList.add('swiping');
                    event.target.style.zIndex = '100';
                },
                move(event) {
                    const dx = event.pageX - event.x0;
                    const dy = event.pageY - event.y0;
                    const absX = Math.abs(dx);
                    const absY = Math.abs(dy);
                    const leftIcon = event.target.querySelector('.swipe-icon.left');
                    const rightIcon = event.target.querySelector('.swipe-icon.right');

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

                    // Показываем индикаторы при движении > 40px (раньше для лучшего UX)
                    if (absX > 40) {
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

                    // CSS touch-action автоматически восстанавливается при удалении класса .swiping

                    // Убираем классы
                    card.classList.remove('swiping', 'swipe-left', 'swipe-right');
                    const leftIcon = card.querySelector('.swipe-icon.left');
                    const rightIcon = card.querySelector('.swipe-icon.right');
                    if (leftIcon) leftIcon.classList.remove('visible');
                    if (rightIcon) rightIcon.classList.remove('visible');
                    card.style.zIndex = '';

                    // Определяем действие ТОЛЬКО после отпускания пальца
                    const isQuickSwipe = event.speed && event.speed > 0.5;
                    const threshold = isQuickSwipe ? 70 : 90;
                    
                    if (absX > threshold) {
                        if (dx < 0 && deleteBtn) {
                            // Анимация удаления с аппаратным ускорением
                            card.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';
                            card.style.transform = 'translate3d(-100%, 0, 0)';
                            card.style.opacity = '0';
                            setTimeout(() => deleteBtn.click(), 400);
                        } else if (dx > 0 && favoriteBtn) {
                            // Анимация добавления в избранное с аппаратным ускорением
                            card.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';
                            card.style.transform = 'translate3d(100%, 0, 0)';
                            card.style.opacity = '0';
                            setTimeout(() => favoriteBtn.click(), 400);
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
        // Настройка для Telegram WebApp - расширенная блокировка
        if (window.Telegram?.WebApp) {
            try {
                window.Telegram.WebApp.expand();
                // Блокируем сворачивание для больших экранов
                if (window.Telegram.WebApp.setHeaderColor) {
                    window.Telegram.WebApp.setHeaderColor('#F0F0F0');
                }
                // Блокируем свайп сверху если поддерживается
                if (window.Telegram.WebApp.disableVerticalSwipes) {
                    window.Telegram.WebApp.disableVerticalSwipes();
                }
            } catch (e) {}
        }

        // CSS touch-action обеспечивает всю необходимую блокировку
        
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