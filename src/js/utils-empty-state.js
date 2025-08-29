// utils-empty-state.js — функция для показа пустого состояния с анимацией собачки

(function() {
  'use strict';

  // Переопределяем функцию renderEmptyState с локальным GIF
  function renderEmptyState(container, message) {
    if (!container) {
      console.error('renderEmptyState: контейнер не найден');
      return;
    }

    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';

    const img = document.createElement('img');
    img.className = 'empty-state-gif';
    img.alt = 'Анимация собачки';
    img.src = 'https://oshu-vacancies.github.io/oshuwork-mini-app/doggie.gif'; // Используем CDN
    img.loading = 'lazy'; // Оптимизация загрузки

    const p = document.createElement('p');
    p.className = 'empty-state-text';
    p.textContent = message;

    emptyDiv.appendChild(img);
    emptyDiv.appendChild(p);

    container.innerHTML = '';
    container.appendChild(emptyDiv);
  }

  // Переопределяем глобальную функцию в utils
  if (window.utils) {
    window.utils.renderEmptyState = renderEmptyState;
  } else {
    window.utils = { renderEmptyState };
  }

})();
