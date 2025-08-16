# oshu://work - Мини-приложение для поиска вакансий

Telegram мини-приложение для автоматического сбора и классификации вакансий из Telegram-каналов с использованием AI.

## 🏗️ Архитектура проекта

### 1. Фронтенд (oshu_vacancies)
- **Статический сайт** с тремя вкладками вакансий
- **Технологии**: HTML5, CSS3, JavaScript (ES6+)
- **Функции**: поиск, фильтрация, избранное, настройки
- **Интеграция**: Supabase REST API

### 2. Парсер (oshu-parser)
- **Python-скрипт** для мониторинга Telegram-каналов
- **Технологии**: Telethon, httpx, asyncio
- **Функции**: 
  - Мониторинг активных каналов каждые 10 минут
  - Фильтрация по ключевым словам
  - Отправка данных в edge-функцию
- **Хостинг**: Amvera (Python 3.11)

### 3. Мозг (Supabase Edge Function)
- **Deno-функция** для обработки вакансий
- **Технологии**: OpenAI GPT-4, Supabase
- **Функции**:
  - AI-классификация вакансий по категориям
  - Извлечение структурированных данных
  - Сохранение в базу данных

## 📁 Структура проекта

```
oshu_vacancies/
├── 📱 Фронтенд
│   ├── index.html          # Главная страница
│   ├── script.js           # Основная логика
│   ├── utils.js            # Утилиты
│   ├── style.css           # Стили
│   ├── config.js           # Конфигурация Supabase
│   ├── favorites.html/js   # Страница избранного
│   └── settings.html/js    # Страница настроек
├── 🤖 Парсер
│   ├── parser.py           # Основной скрипт
│   ├── requirements.txt    # Зависимости Python
│   └── amvera.yml         # Конфигурация Amvera
└── 🧠 Edge-функция
    └── index.ts            # Supabase Edge Function
```

## 🚀 Быстрый старт

### 1. Фронтенд
```bash
# Клонировать репозиторий
git clone https://github.com/OshuNik/oshu_vacancies.git

# Открыть index.html в браузере
# Или развернуть на GitHub Pages/Vercel/Netlify
```

### 2. Парсер
```bash
cd parser/
pip install -r requirements.txt

# Настроить переменные окружения
export API_ID="your_telegram_api_id"
export API_HASH="your_telegram_api_hash"
export SESSION_NAME="session_name"
export SUPABASE_URL="your_supabase_url"
export SUPABASE_ANON_KEY="your_supabase_anon_key"
export SUPABASE_FUNCTION_URL="your_edge_function_url"

# Запустить
python parser.py
```

### 3. Supabase
- Создать проект в Supabase
- Развернуть edge-функцию `process-vacancy`
- Настроить таблицы: `vacancies`, `channels`, `settings`, `default_channels`

## 🔧 Конфигурация

### Переменные окружения парсера
- `API_ID` - Telegram API ID
- `API_HASH` - Telegram API Hash  
- `SESSION_NAME` - Имя сессии
- `SUPABASE_URL` - URL проекта Supabase
- `SUPABASE_ANON_KEY` - Публичный ключ Supabase
- `SUPABASE_FUNCTION_URL` - URL edge-функции

### Конфигурация фронтенда
В `config.js`:
```javascript
window.APP_CONFIG = {
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'your_anon_key',
  PAGE_SIZE_MAIN: 10,
  // ... другие настройки
};
```

## 📊 База данных

### Основные таблицы
- **vacancies** - вакансии с AI-классификацией
- **channels** - список Telegram-каналов
- **settings** - ключевые слова пользователя
- **default_channels** - стандартный набор каналов

### Индексы
```sql
CREATE INDEX idx_vacancies_status_ts ON vacancies(status, timestamp DESC);
CREATE INDEX idx_vacancies_category ON vacancies(category);
```

## 🎯 Функциональность

### Категории вакансий
1. **ТОЧНО ТВОЁ** - монтаж/моушн как основная задача
2. **МОЖЕТ БЫТЬ** - смежные роли с элементами монтажа
3. **НЕ ТВОЁ** - нерелевантные вакансии

### Действия с вакансиями
- ✈️ Откликнуться (если есть apply_url)
- ♥️ Добавить в избранное
- ✕ Скрыть/удалить
- 📖 Показать полный текст
- 🖼️ Просмотр изображений

## 🔒 Безопасность

- RLS (Row Level Security) для таблиц
- Публичный ANON_KEY для фронтенда
- SERVICE_KEY для edge-функций
- Валидация входных данных

## 📈 Мониторинг

- Логирование всех операций
- Метрики по категориям вакансий
- Отслеживание ошибок парсера
- Статистика использования

## 🚧 Разработка

### Локальная разработка
```bash
# Фронтенд
python -m http.server 8000

# Парсер
python parser.py

# Edge-функция
supabase functions serve process-vacancy
```

### Тестирование
```bash
npm run check-fixes    # Проверка исправлений
npm run test-app       # Тестирование приложения
```

## 🔒 Безопасность и Аудит

📋 **[SECURITY-AUDIT.md](./SECURITY-AUDIT.md)** - Полный аудит безопасности и рекомендации по оптимизации

### Ключевые моменты:
- ✅ **Rate Limiting** - Защита от злоупотреблений API
- ✅ **Модуляризация** - JavaScript код разделен на модули  
- ⚠️ **CSS Оптимизация** - Требует осторожного поэтапного подхода
- ✅ **Accessibility** - Соответствие стандартам WAI-ARIA

## 📝 Лицензия

Проект разработан OshuNik для автоматизации поиска вакансий в сфере монтажа и моушн-дизайна.

---

**Версия**: 1.0.0  
**Последнее обновление**: 2025  
**Статус**: В разработке
