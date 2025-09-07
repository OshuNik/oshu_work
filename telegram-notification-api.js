/**
 * Telegram Notification API для отправки уведомлений через бота
 * Этот файл нужно добавить на сервер где работает парсер (Amvera)
 */

const TELEGRAM_BOT_TOKEN = '8289350418:AAFdMsPV60DLnsyGeg8GNE7-HGUPr82Oc2w';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Пока что фиксированный User ID, потом добавим авторизацию
const ADMIN_USER_ID = '1521478462';

/**
 * Express endpoint для отправки уведомлений
 * POST /api/send-notification
 */
async function sendTelegramNotification(req, res) {
  try {
    const { vacancy, category_filter, enabled } = req.body;

    // Проверяем что уведомления включены
    if (!enabled) {
      return res.json({ success: false, reason: 'notifications_disabled' });
    }

    // Проверяем фильтр категории
    if (category_filter !== 'all' && vacancy.category !== category_filter) {
      return res.json({ success: false, reason: 'category_filtered' });
    }

    // Формируем сообщение
    const message = formatVacancyMessage(vacancy);

    // Отправляем через Telegram Bot API
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: ADMIN_USER_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const result = await response.json();

    if (result.ok) {
      console.log(`✅ Уведомление отправлено: ${vacancy.title}`);
      res.json({ success: true, message_id: result.result.message_id });
    } else {
      console.error('❌ Ошибка Telegram API:', result);
      res.status(500).json({ success: false, error: result.description });
    }

  } catch (error) {
    console.error('❌ Ошибка отправки уведомления:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Форматирование сообщения о вакансии
 */
function formatVacancyMessage(vacancy) {
  const categoryEmoji = {
    'ТОЧНО ТВОЁ': '🎯',
    'МОЖЕТ БЫТЬ': '🤔',
    'НЕ ТВОЁ': '❌'
  };

  const emoji = categoryEmoji[vacancy.category] || '📋';
  
  let message = `${emoji} <b>Новая вакансия!</b>\n\n`;
  
  if (vacancy.title) {
    message += `💼 <b>${vacancy.title}</b>\n`;
  }
  
  if (vacancy.company) {
    message += `🏢 ${vacancy.company}\n`;
  }
  
  if (vacancy.industry) {
    message += `📊 ${vacancy.industry}\n`;
  }
  
  if (vacancy.reason) {
    message += `🔍 <i>${vacancy.reason}</i>\n`;
  }
  
  message += `\n📂 Категория: <b>${vacancy.category}</b>`;
  message += `\n🆔 ID: <code>${vacancy.id}</code>`;
  
  if (vacancy.text && vacancy.text.length > 0) {
    const shortText = vacancy.text.length > 200 
      ? vacancy.text.substring(0, 200) + '...' 
      : vacancy.text;
    message += `\n\n📝 <i>${shortText}</i>`;
  }
  
  return message;
}

/**
 * Проверка статуса бота
 * GET /api/bot-status
 */
async function getBotStatus(req, res) {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/getMe`);
    const result = await response.json();
    
    if (result.ok) {
      res.json({ 
        success: true, 
        bot: result.result,
        admin_user_id: ADMIN_USER_ID
      });
    } else {
      res.status(500).json({ success: false, error: result.description });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// Экспорт для использования в Express приложении
module.exports = {
  sendTelegramNotification,
  getBotStatus,
  TELEGRAM_BOT_TOKEN,
  ADMIN_USER_ID
};

// Пример использования в Express:
/*
const express = require('express');
const { sendTelegramNotification, getBotStatus } = require('./telegram-notification-api');

const app = express();
app.use(express.json());

app.post('/api/send-notification', sendTelegramNotification);
app.get('/api/bot-status', getBotStatus);

app.listen(3000, () => {
  console.log('Notification API запущен на порту 3000');
});
*/