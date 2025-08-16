// Swipe Handler для карточек вакансий
(function() {
    'use strict';

    function initSwipeHandler() {
        if (typeof interact === 'undefined') {
            console.warn('interact.js не загружен');
            return;
        }

        // Настройка свайпов для карточек
        console.log('SwipeHandler: настраиваем draggable для', document.querySelectorAll('.vacancy-card').length, 'карточек');
        
        interact('.vacancy-card').draggable({
            // Разрешить свайп только с области карточки
            allowFrom: '.card-body, .card-header',
            // Игнорировать кнопки и ссылки
            ignoreFrom: 'button, a, input, .image-link-button, .card-actions',
            // Ограничить движение только по горизонтали
            startAxis: 'x',
            lockAxis: 'x',
            // Требуем минимальное движение для старта
            hold: 50,
            listeners: {
                start(event) {
                    console.log('SwipeHandler: начало свайпа');
                    event.target.classList.add('swiping');
                    event.target.style.zIndex = '100';
                },
                move(event) {
                    // Используем относительное смещение от начала свайпа
                    const dx = event.pageX - event.x0;
                    const absX = Math.abs(dx);
                    const leftIcon = event.target.querySelector('.swipe-icon.left');
                    const rightIcon = event.target.querySelector('.swipe-icon.right');

                    // Ограничиваем максимальное смещение
                    const maxMove = 120;
                    const limitedDx = Math.max(-maxMove, Math.min(maxMove, dx));

                    // Двигаем карточку плавно
                    event.target.style.transform = `translateX(${limitedDx}px)`;

                    // Показываем иконки и меняем цвет при движении > 40px
                    if (absX > 40) {
                        if (dx < 0) {
                            // Свайп влево - удалить
                            event.target.classList.add('swipe-left');
                            event.target.classList.remove('swipe-right');
                            if (leftIcon) leftIcon.classList.add('visible');
                            if (rightIcon) rightIcon.classList.remove('visible');
                        } else {
                            // Свайп вправо - в избранное
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

                    console.log('SwipeHandler: конец свайпа, dx:', dx, 'absX:', absX);

                    // Убираем классы
                    card.classList.remove('swiping', 'swipe-left', 'swipe-right');
                    const leftIcon = card.querySelector('.swipe-icon.left');
                    const rightIcon = card.querySelector('.swipe-icon.right');
                    if (leftIcon) leftIcon.classList.remove('visible');
                    if (rightIcon) rightIcon.classList.remove('visible');
                    card.style.zIndex = '';

                    // Если свайп больше 80px - выполняем действие
                    if (absX > 80) {
                        if (dx < 0 && deleteBtn) {
                            // Свайп влево - удалить
                            console.log('SwipeHandler: удаляем карточку');
                            card.style.transform = 'translateX(-100%)';
                            card.style.opacity = '0';
                            setTimeout(() => {
                                console.log('SwipeHandler: кликаем delete кнопку');
                                deleteBtn.click();
                            }, 300);
                        } else if (dx > 0 && favoriteBtn) {
                            // Свайп вправо - в избранное
                            console.log('SwipeHandler: добавляем в избранное');
                            card.style.transform = 'translateX(100%)';
                            card.style.opacity = '0';
                            setTimeout(() => {
                                console.log('SwipeHandler: кликаем favorite кнопку');
                                favoriteBtn.click();
                            }, 300);
                        } else {
                            // Возвращаем на место если нет кнопки
                            console.log('SwipeHandler: кнопка не найдена, возвращаем карточку');
                            card.style.transform = 'translateX(0px)';
                        }
                    } else {
                        // Возвращаем на место
                        console.log('SwipeHandler: свайп недостаточный, возвращаем карточку');
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

    // Инициализация свайпов для новых карточек
    function initForNewCards() {
        if (typeof interact === 'undefined') return;
        
        // Реинициализируем interact для всех карточек
        interact('.vacancy-card').unset();
        initSwipeHandler();
    }

    // Инициализация
    function init() {
        console.log('SwipeHandler: инициализация');
        console.log('SwipeHandler: window.interact =', typeof window.interact);
        console.log('SwipeHandler: все window keys:', Object.keys(window).filter(k => k.includes('interact')));
        
        // Ждем загрузки interact.js
        if (typeof interact !== 'undefined') {
            console.log('SwipeHandler: interact.js найден');
            initSwipeHandler();
            addSwipeIcons();
            
            // Следим за добавлением новых карточек
            const observer = new MutationObserver(() => {
                addSwipeIcons();
                initForNewCards();
            });
            
            // Наблюдаем за изменениями в контейнерах вакансий
            document.querySelectorAll('.vacancy-list').forEach(list => {
                observer.observe(list, { childList: true, subtree: true });
            });
        } else {
            console.log('SwipeHandler: ждем interact.js (попытка через', (Date.now() - window.swipeInitTime) + 'мс)');
            if (!window.swipeInitTime) window.swipeInitTime = Date.now();
            
            // Останавливаем попытки через 10 секунд
            if (Date.now() - window.swipeInitTime < 10000) {
                setTimeout(init, 200);
            } else {
                console.error('SwipeHandler: interact.js не загрузился за 10 секунд');
            }
        }
    }

    // Запускаем после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Слушаем событие загрузки interact.js
    window.addEventListener('interactLoaded', () => {
        console.log('SwipeHandler: получено событие interactLoaded');
        if (typeof interact !== 'undefined') {
            console.log('SwipeHandler: interact.js готов к использованию');
            initSwipeHandler();
            addSwipeIcons();
            
            // Следим за добавлением новых карточек
            const observer = new MutationObserver(() => {
                addSwipeIcons();
                initForNewCards();
            });
            
            // Наблюдаем за изменениями в контейнерах вакансий
            document.querySelectorAll('.vacancy-list').forEach(list => {
                observer.observe(list, { childList: true, subtree: true });
            });
        }
    });

    // Тестовая инициализация по клику (удалить после тестов)
    window.addEventListener('click', function(e) {
        if (e.target.textContent === 'TEST_SWIPE') {
            console.log('Принудительная инициализация свайпов');
            initSwipeHandler();
            addSwipeIcons();
        }
    });

    // Экспортируем функции для использования в других модулях
    window.SwipeHandler = {
        init: initSwipeHandler,
        addIcons: addSwipeIcons,
        initForNewCards: initForNewCards
    };
})();