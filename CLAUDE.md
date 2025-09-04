# 🤖 Claude Code Project Documentation

## oshu://work - Telegram Mini App для поиска вакансий

### 📋 Последние изменения

**Дата:** Сентябрь 2025  
**Версия:** v15.1  
**Статус:** Production-Ready с оптимизациями производительности  

---

## 🛠 Команды разработки

```bash
# Разработка
npm run dev      # Сервер разработки (обычно порт 4179)

# Production
npm run build    # Сборка для продакшена
npm run preview  # Тест production сборки (обычно порт 4181)

# Дополнительные команды  
npm run clean    # Очистка dist/
npm run dev:full # Полная разработка с mock WebSocket
```

---

## 📁 Архитектура проекта

### Структура файлов
```
Фронтенд/
├── src/
│   ├── css/
│   │   ├── variables.css      # 🆕 Общие CSS переменные
│   │   ├── critical.css       # Критичные стили для First Paint
│   │   ├── style.css         # Стили главной страницы
│   │   └── retro-settings.css # Стили страницы настроек
│   ├── js/
│   │   ├── main.js           # Главная точка входа
│   │   ├── settings-main.js  # Точка входа настроек
│   │   ├── bot-integration.js # 🔄 Упрощенные уведомления
│   │   └── [other modules]
├── index.html         # Главная страница
├── settings.html      # Страница настроек  
├── favorites.html     # Страница избранного
├── _headers          # 🔄 Обновленные заголовки кэширования
├── vite.config.js    # 🔄 Оптимизированная конфигурация сборки
└── PERFORMANCE.md    # 🆕 Отчет по производительности
```

### Ключевые компоненты
- **VacancyManager** - управление вакансиями
- **SimpleBotNotifications** - 🔄 упрощенная система уведомлений
- **ThemeManager** - переключение тем
- **SwipeHandler** - обработка свайпов карточек

---

## 🚀 Оптимизации производительности (Последние)

### CSS Оптимизации
- ✅ Создан `variables.css` для устранения дублирования
- ✅ GZIP сжатие: 88KB → 13KB (85% экономия)
- ✅ Оптимизирована структура импортов

### JavaScript Оптимизации  
- ✅ Селективное удаление логов: убраны `console.log/info/debug`, оставлены `error/warn`
- ✅ Улучшенная минификация с Terser
- ✅ Bundle размеры оптимизированы

### Загрузка ресурсов
- ✅ Асинхронная загрузка шрифтов с `preload`
- ✅ Оптимизированные заголовки кэширования
- ✅ Долгосрочное кэширование статических ресурсов (1 год)

---

## 🔧 Конфигурация

### Vite Build Settings
```javascript
// Критичные настройки в vite.config.js
{
  base: '/oshu_work/',
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: isProd ? ['log', 'info', 'debug'] : false,
        drop_debugger: isProd
      }
    }
  }
}
```

### Caching Headers
```
# Новые настройки в _headers
/assets/*         # max-age=31536000 (1 год)
/js/*            # max-age=31536000 (1 год) 
/*.html          # max-age=300 (5 минут)
```

---

## 🎯 Система уведомлений

### Текущая реализация (SimpleBotNotifications)
- **Файл:** `src/js/bot-integration.js`
- **Статус:** Рабочая упрощенная версия
- **Функции:**
  - Переключение вкл/выкл через кнопку в настройках
  - Долгое нажатие → меню выбора категории
  - localStorage для сохранения настроек
  - Toast уведомления в dev режиме
  - Telegram WebApp Alert в production

### UI Компоненты
- **Кнопка:** В header настроек рядом с переключателем темы
- **Анимация:** 🆕 Плавная заливка при долгом нажатии (слева направо)
- **Меню:** Всплывающее окно выбора категорий

---

## 📱 Telegram Mini App Features

### Интеграция
- WebApp API подключение
- Автоматическое расширение на полный экран
- Поддержка тем Telegram
- Haptic feedback для кнопок

### Безопасность
- Строгий CSP с nonce-based защитой
- HSTS с preload
- Защита от XSS и clickjacking

---

## 🐛 Отладка и логирование

### Production Logging
- ✅ `console.error()` - критичные ошибки
- ✅ `console.warn()` - предупреждения  
- ❌ `console.log()` - убрано
- ❌ `console.info()` - убрано
- ❌ `console.debug()` - убрано

### Development
- Все логи доступны для отладки
- Hot reload через Vite
- Source maps включены

---

## 📊 Метрики производительности

### Bundle Sizes (GZIP)
- **Main CSS:** 13KB (было 88KB)
- **Settings CSS:** 4.56KB (было 24KB)  
- **Main JS:** ~18KB (оптимизировано)
- **Variables CSS:** 0.37KB (новый)

### Performance Score: 8.5/10
- Быстрая загрузка на мобильных сетях
- Эффективное кэширование
- Оптимизировано для Telegram Mini App

---

## 🔄 Последние коммиты

1. **UI improvements:** Удаление вкладки уведомлений, исправление верстки
2. **Performance optimization:** Оптимизация bundle, шрифтов, кэширования

---

## ⚡ Быстрые команды для Claude

```bash
# Запуск разработки
cd "E:\ОшуВорк\КЛОД\Фронтенд" && npm run dev

# Сборка и предпросмотр  
cd "E:\ОшуВорк\КЛОД\Фронтенд" && npm run build && npm run preview

# Git workflow
git add . && git commit -m "feat: описание" && git push origin main
```

---

**Важные файлы для изменений:**
- `src/js/bot-integration.js` - система уведомлений
- `src/css/retro-settings.css` - стили настроек  
- `vite.config.js` - конфигурация сборки
- `_headers` - настройки кэширования

**Следующие приоритеты:**
- Service Worker для offline режима
- Дополнительные оптимизации изображений
- A/B тестирование производительности