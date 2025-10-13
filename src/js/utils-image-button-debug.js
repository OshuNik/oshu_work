// utils-image-button-debug.js - Debug патч для кнопки изображения

(function() {
  'use strict';

  // Переопределяем createVacancyCard с debug логированием
  const originalCreateVacancyCard = window.utils?.createVacancyCard;

  if (!originalCreateVacancyCard) {
    console.warn('utils.createVacancyCard не найдена - патч не применён');
    return;
  }

  window.utils.createVacancyCard = function(v, options = {}) {
    // Вызываем оригинальную функцию
    const card = originalCreateVacancyCard(v, options);

    // Debug логирование для изображений
    console.group(`🖼️ Image Button Debug - Vacancy ID: ${v.id}`);
    console.log('has_image:', v.has_image);
    console.log('message_link:', v.message_link);
    console.log('image_link:', v.image_link);
    console.log('reason:', v.reason?.substring(0, 100));
    console.log('text_highlighted:', v.text_highlighted?.substring(0, 100));

    // Проверяем условия
    const originalDetailsHtml = String(v.text_highlighted || '').replace(/\[\s*Изображение\s*\]\s*/gi, '');
    const containsMarkerInDetails = /(\[\s*изображени[ея]\s*\]|\b(изображени[ея]|фото|картинк\w|скрин)\b)/i.test(originalDetailsHtml);
    const containsMarkerInReason = /(\[\s*изображени[ея]\s*\]|\b(изображени[ея]|фото|картинк\w|скрин)\b)/i.test(v.reason || '');

    console.log('✓ Contains marker in details:', containsMarkerInDetails);
    console.log('✓ Contains marker in reason:', containsMarkerInReason);
    console.log('✓ Allow condition:', (v.has_image === true) || containsMarkerInDetails || containsMarkerInReason);

    // Проверяем наличие кнопки в карточке
    const attachmentsDiv = card.querySelector('[data-element="attachments"]');
    const imageButton = attachmentsDiv?.querySelector('.image-link-button');
    console.log('✓ Attachments div exists:', !!attachmentsDiv);
    console.log('✓ Image button exists:', !!imageButton);
    if (imageButton) {
      console.log('✓ Image button href:', imageButton.href);
    }

    console.groupEnd();

    return card;
  };

  console.log('✅ Image button debug patch applied');
})();
