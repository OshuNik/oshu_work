# oshu://work

Веб-приложение для поиска и управления вакансиями с ретро-дизайном.

## 📁 Структура проекта

```
oshu_work/
├── src/
│   ├── js/                    # JavaScript файлы
│   │   ├── config.js          # Конфигурация приложения
│   │   ├── constants.js       # Константы
│   │   ├── utils.min.js       # Утилиты
│   │   ├── state-manager.js   # Управление состоянием
│   │   ├── api-service.js     # API сервис
│   │   ├── dom-manager.js     # Управление DOM
│   │   ├── event-manager.js   # Управление событиями
│   │   ├── vacancy-manager.js # Управление вакансиями
│   │   ├── app-controller.js  # Главный контроллер
│   │   ├── swipe-handler.js   # Обработка свайпов
│   │   ├── template-loader.js # Загрузчик шаблонов
│   │   ├── theme-manager.js   # Управление темами
│   │   ├── settings.js        # Логика настроек
│   │   └── favorites.js       # Логика избранного
│   ├── css/                   # Стили
│   │   ├── style.css          # Основные стили
│   │   ├── critical.css       # Критические стили
│   │   └── retro-settings.css # Стили настроек
│   ├── html/                  # HTML страницы
│   │   ├── index.html         # Главная страница
│   │   ├── settings.html      # Страница настроек
│   │   ├── favorites.html     # Страница избранного
│   │   └── vacancy-card-template.html # Шаблон карточки
│   ├── modules/               # Модули настроек
│   │   ├── SettingsMain.js    # Основные настройки
│   │   ├── SettingsUI.js      # UI настроек
│   │   ├── ChannelsManager.js # Управление каналами
│   │   ├── KeywordsManager.js # Управление ключевыми словами
│   │   └── SettingsUtils.js   # Утилиты настроек
│   └── assets/                # Ресурсы (пустая папка)
├── .gitignore                 # Git ignore файл
└── README.md                  # Документация
```

## 🚀 Запуск

1. Открой `src/html/index.html` в браузере
2. Или используй GitHub Pages: `https://oshunik.github.io/oshu_work/`

## ✨ Особенности

- 📱 Адаптивный дизайн
- 🎨 Ретро-стиль с пиксельной графикой
- 🌙 Поддержка темной/светлой темы
- ⭐ Система избранного
- ⚙️ Гибкие настройки
- 🔍 Поиск по вакансиям
- 📱 Поддержка свайпов

## 🛠️ Технологии

- HTML5, CSS3, JavaScript ES6+
- Модульная архитектура
- Responsive design
- Progressive Web App (PWA) возможности
