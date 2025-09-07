# 🤖 Настройка уведомлений через Telegram Bot

## 📋 Что нужно сделать

### 1. Добавить файл в парсер (Amvera)

Скопируйте файл `telegram-notification-api.js` в проект парсера на GitHub/Amvera.

### 2. Интегрировать с Express сервером

Добавьте в ваш главный файл парсера:

```javascript
const express = require('express');
const { sendTelegramNotification, getBotStatus } = require('./telegram-notification-api');

const app = express();
app.use(express.json());

// Добавьте эти маршруты
app.post('/api/send-notification', sendTelegramNotification);
app.get('/api/bot-status', getBotStatus);

app.listen(3000, () => {
  console.log('🤖 Notification API запущен');
});
```

### 3. Обновить URL в фронтенде  

В файле `bot-integration.js` замените:
```javascript
: 'https://your-amvera-domain.com/api/send-notification'; 
```

На ваш реальный домен Amvera, например:
```javascript
: 'https://parser-oshu.amvera.io/api/send-notification';
```

### 4. Настроить CORS (если нужно)

Добавьте в парсер:
```javascript
const cors = require('cors');
app.use(cors({
  origin: ['https://oshunik.github.io', 'http://localhost:4179'],
  credentials: true
}));
```

## 🔧 Как это работает

1. **Пользователь включает уведомления** в Mini App настройках
2. **Парсер находит новую вакансию** и сохраняет в Supabase  
3. **Realtime Manager** получает событие `vacancy:new`
4. **Bot Integration** вызывает `/api/send-notification`
5. **Telegram Bot API** отправляет сообщение пользователю

## 📱 Формат уведомления

```
🎯 Новая вакансия!

💼 Senior JavaScript Developer
🏢 Tech Solutions  
📊 IT
🔍 JavaScript, React, высокая зарплата

📂 Категория: ТОЧНО ТВОЁ
🆔 ID: 12345

📝 Ищем опытного JS разработчика для работы с React/Node.js...
```

## ✅ Готовые данные

- **Bot Token:** `8289350418:AAFdMsPV60DLnsyGeg8GNE7-HGUPr82Oc2w`
- **Admin User ID:** `1521478462`  
- **API готов:** ✅ Код написан
- **Фронтенд готов:** ✅ Интеграция добавлена

## 🚀 Следующие шаги

1. Добавьте код в парсер на Amvera
2. Укажите правильный URL домена  
3. Протестируйте отправку вакансии в канал
4. Проверьте приходят ли уведомления в бот

После настройки при включенных уведомлениях в Mini App вам будут приходить сообщения от @oshuparserbot о новых подходящих вакансиях! 🎯