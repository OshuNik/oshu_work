# Стиль-гайд главного окна oshu://work

## 🎯 Обзор дизайн-системы

Приложение использует **ретро-пиксельный дизайн** с современными UX-принципами. Основа - минимализм, читаемость и интуитивность.

---

## 🎨 Цветовая палитра

### Основные цвета
```css
/* Светлая тема (по умолчанию) */
--background-color: #F0F0F0    /* Основной фон */
--card-color: #FFFFFF          /* Фон карточек */
--text-color: #000000          /* Основной текст */
--hint-color: #666666          /* Подсказки */
--border-color: #000000        /* Границы */
```

### Акцентные цвета
```css
--accent-red: #FF5C5C          /* Удаление, ошибки */
--accent-yellow: #FFD93D       /* Предупреждения, категория "Может быть" */
--accent-green: #6BCB77        /* Успех, категория "Точно твоё" */
--accent-blue: #41A6FF         /* Ссылки, действия */
```

### Градиенты заголовков
```css
--header-gradient-keywords: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)
--header-gradient-channels: linear-gradient(135deg, #6BCB77 0%, #4CAF50 100%)
--header-gradient-appearance: linear-gradient(135deg, #FF6B6B 0%, #FF5252 100%)
```

---

## 🔤 Типографика

### Шрифты
```css
--font-mono: 'Roboto Mono', 'Courier New', monospace      /* Основной текст */
--font-pixel: 'Press Start 2P', 'Courier New', monospace  /* Заголовки */
```

### Размеры
```css
--subtitle-size: 14px           /* Подзаголовки */
--description-size: 14px        /* Описания */
```

---

## 📐 Размеры и отступы

### Унифицированные размеры
```css
--card-padding: 20px            /* Внутренние отступы карточек */
--card-margin: 20px             /* Внешние отступы карточек */
--card-border: 4px              /* Толщина границ */
--card-radius: 8px              /* Скругление углов */
--button-padding: 12px 20px     /* Отступы кнопок */
```

### Тени и границы
```css
--border-width: 2px             /* Толщина границ */
--shadow-offset: 4px            /* Смещение теней */
--box-shadow: 4px 4px 0px var(--border-color)           /* Обычная тень */
--box-shadow-pressed: 2px 2px 0px var(--border-color)   /* Нажатая тень */
```

---

## 🎭 Компоненты

### 1. Header (Заголовок)
```css
.header {
    padding-bottom: 25px;
    text-align: center;
}

.header h1 {
    font-family: var(--font-pixel);
    font-size: 28px;
    letter-spacing: 1.5px;
    margin: 0 0 15px 0;
}
```

**Особенности:**
- Центрированное выравнивание
- Пиксельный шрифт для заголовка
- Отступ снизу 25px

### 2. Header Actions (Кнопки в заголовке)
```css
.header-button {
    font-size: 14px;
    padding: 10px 18px;
    border-radius: 12px;
    background-color: var(--card-color);
    border: 2px solid var(--border-color);
    box-shadow: var(--box-shadow);
    transition: transform 0.1s, box-shadow 0.1s;
}
```

**Состояния:**
- `:active` - сдвиг вниз и уменьшение тени
- Hover эффекты отсутствуют (мобильная оптимизация)

### 3. Search Container (Поиск)
```css
.search-input {
    width: 100%;
    padding: 12px 36px 12px 12px;
    border: 2px solid var(--border-color);
    border-radius: 8px;
    box-shadow: var(--box-shadow);
    font-family: var(--font-mono);
    font-size: 15px;
}
```

**Особенности:**
- Правая кнопка очистки (36px отступ справа)
- Тень в ретро-стиле
- Фокус: синяя граница

### 4. Category Tabs (Вкладки категорий)
```css
.tab-button {
    font-family: var(--font-mono);
    background: #e0e0e0;
    border: 2px solid var(--border-color);
    border-bottom: none;
    padding: 10px 12px;
    border-radius: 8px 8px 0 0;
    position: relative;
    top: 10px;
}
```

**Активные состояния:**
```css
.tab-button.main.active { background-color: var(--accent-green); }
.tab-button.maybe.active { background-color: var(--accent-yellow); }
.tab-button.other.active { background-color: var(--accent-red); }
```

---

## 🎨 Темная тема

### Переключение
```css
[data-theme="dark"] {
    --background-color: #0F0F0F;
    --card-color: #1E1E1E;
    --text-color: #F5F5F5;
    --border-color: #3A3A3A;
}
```

**Особенности:**
- Убираются тени для лучшей интеграции
- Улучшенные акцентные цвета
- Высокий контраст для читаемости

---

## 📱 Адаптивность

### Мобильная оптимизация
```css
@media (max-width: 768px) {
    .header h1 { font-size: 24px; }
    .search-input { padding: 10px 30px 10px 10px; }
    .tab-button { font-size: 12px; padding: 8px 10px; }
}
```

### Touch-friendly элементы
```css
.tab-button {
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    -webkit-touch-callout: none;
}
```

---

## ⚡ Анимации и переходы

### Временные параметры
```css
--transition-fast: 0.1s ease-out      /* Кнопки, активные состояния */
--transition-normal: 0.2s ease-out    /* Hover, фокус */
--transition-slow: 0.3s ease-out      /* Смена тем, сложные переходы */
```

### Оптимизация производительности
```css
.vacancy-card {
    will-change: transform;           /* Оптимизация анимаций */
    backface-visibility: hidden;      /* Улучшение плавности */
}
```

---

## 🎯 Принципы дизайна

### 1. Ретро-стиль
- **Тени**: Смещение 4px вправо-вниз
- **Границы**: Толстые (2-4px), черные
- **Цвета**: Высокий контраст, яркие акценты

### 2. Мобильная оптимизация
- **Touch targets**: Минимум 44px
- **Жесты**: Поддержка свайпов
- **Производительность**: will-change, оптимизированные анимации

### 3. Доступность
- **Контраст**: Соответствие WCAG AA
- **Фокус**: Видимые состояния для клавиатуры
- **ARIA**: Семантическая разметка

---

## 🚫 Что НЕ делать

### ❌ Плохие практики
- Использовать тени с размытием (box-shadow с blur)
- Добавлять градиенты без необходимости
- Создавать сложные hover-эффекты на мобильных
- Использовать цвета вне палитры

### ✅ Хорошие практики
- Следовать системе цветов
- Использовать унифицированные размеры
- Применять ретро-стиль последовательно
- Оптимизировать для производительности

---

## 🔧 Утилитарные классы

### Базовые утилиты
```css
.hidden { display: none !important; }
.retro-shadow { box-shadow: var(--box-shadow); }
.retro-border { border: var(--border-width) solid var(--border-color); }
```

### Состояния
```css
.loading { opacity: 0.5; pointer-events: none; }
.error { border-color: var(--accent-red); }
.success { border-color: var(--accent-green); }
```

---

## 📋 Чек-лист для новых компонентов

- [ ] Использует цвета из палитры
- [ ] Следует системе размеров
- [ ] Имеет ретро-стиль (тени, границы)
- [ ] Оптимизирован для мобильных
- [ ] Поддерживает темную тему
- [ ] Использует правильные шрифты
- [ ] Имеет доступные состояния (focus, active)
- [ ] Оптимизирован для производительности

---

*Стиль-гайд обновлен: v12.3 | Последняя правка: 2024*
