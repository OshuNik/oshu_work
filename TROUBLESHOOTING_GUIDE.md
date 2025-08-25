# 🚨 Мини-гайд: Проблема с "слетанием" дизайна

## ❌ Что происходило

**Симптомы:**
- При переходе в настройки → выход → ломается структура приложения
- При переходе в избранное → выход → слетает дизайн
- В консоли: `RangeError: Maximum call stack size exceeded`

**Диагностика:**
```javascript
// utils.min.js:1 Template #vacancy-card-template not found!
// config.js:12 ⚠️ SUPABASE_URL не найден в переменных окружения
```

## 🔍 Причина проблемы

**Бесконечная рекурсия в JavaScript** из-за дублирования инициализации:

### 1. theme-manager.js
```javascript
// БЫЛО - двойная инициализация
initTheme(); // при загрузке скрипта
document.addEventListener('DOMContentLoaded', initTheme); // при DOM готовности
```

### 2. template-loader.js  
```javascript
// БЫЛО - дублирование загрузки
document.addEventListener('DOMContentLoaded', async () => { ... });
if (document.readyState !== 'loading') { ... } // загрузка снова
```

### 3. HTML файлы
```html
<!-- БЫЛО - дублирование CSS -->
<link rel="preload" href="src/css/style.css" as="style">
<link rel="stylesheet" href="src/css/style.css">

<!-- БЫЛО - дублирование скриптов -->
<script src="./main.js"></script>
<script type="module" src="./main.js"></script>
```

## ✅ Как решалось

### Шаг 1: Убрал двойную инициализацию
```javascript
// СТАЛО - только одна инициализация
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme);
} else {
  initTheme();
}
// УБРАЛ: initTheme(); // дублирование
```

### Шаг 2: Убрал дублирование загрузки шаблонов
```javascript
// СТАЛО - только одна загрузка
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => { ... });
} else {
  // Страница уже готова, загружаем сразу
  (async () => { ... })();
}
```

### Шаг 3: Убрал дублирование в HTML
```html
<!-- СТАЛО - только stylesheet -->
<link rel="stylesheet" href="src/css/style.css">

<!-- СТАЛО - только один скрипт -->
<script src="src/js/favorites.js"></script>
<!-- УБРАЛ: <script type="module" src="./favorites.js"></script> -->
```

### Шаг 4: Добавил недостающий шаблон
```html
<!-- Добавил в index.html -->
<template id="vacancy-card-template">
  <!-- содержимое шаблона -->
</template>
```

### Шаг 5: Исправил загрузку переменных
```javascript
// СТАЛО - ищет и VITE_* и обычные переменные
get supabaseUrl() {
  return getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_URL');
}
```

## 🎯 Результат

- ✅ Дизайн больше не "слетает" при переходах
- ✅ Нет ошибок `Maximum call stack size exceeded`
- ✅ Шаблоны загружаются корректно
- ✅ Переменные Supabase находятся без предупреждений
- ✅ Приложение работает стабильно на всех страницах

## 🚀 Версия

**Исправлено в**: v13.3.0  
**Коммиты**: FIX-001, FIX-002, FIX-003

---

*Гайд создан: 2025-01-25 | Проблема: ✅ РЕШЕНА*
