/**
 * Mock WebSocket Server для разработки
 * Симулирует поступление новых вакансий из Telegram каналов
 */

const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const server = createServer(app);

app.use(cors());
app.use(express.json());

// Создаем WebSocket сервер
const wss = new WebSocketServer({ server, path: '/ws' });

// Подключенные клиенты
const clients = new Set();

// Образцы вакансий для симуляции
const mockVacancies = [
  {
    title: 'Senior JavaScript Developer',
    company: 'Tech Solutions',
    category: 'ТОЧНО ТВОЁ',
    text: 'Ищем опытного JS разработчика для работы с React/Node.js',
    industry: 'IT',
    reason: 'JavaScript, React, высокая зарплата'
  },
  {
    title: 'Frontend разработчик Vue.js',
    company: 'Digital Agency',
    category: 'МОЖЕТ БЫТЬ', 
    text: 'Требуется фронтенд разработчик со знанием Vue.js',
    industry: 'IT',
    reason: 'Vue.js, фронтенд'
  },
  {
    title: 'Менеджер по продажам',
    company: 'Sales Corp',
    category: 'НЕ ТВОЁ',
    text: 'Ищем активного менеджера по продажам',
    industry: 'Sales',
    reason: 'Не IT'
  }
];

// Обработка WebSocket подключений
wss.on('connection', (ws, req) => {
  console.log('🔗 Новое WebSocket подключение');
  clients.add(ws);
  
  // Отправляем welcome сообщение
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Mock WebSocket сервер подключен'
  }));
  
  // Обработка сообщений от клиента
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📨 Получено сообщение:', message);
      
      // Обработка поисковых запросов
      if (message.type === 'search') {
        handleSearchRequest(ws, message);
      }
    } catch (error) {
      console.error('❌ Ошибка обработки сообщения:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket соединение закрыто');
    clients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket ошибка:', error);
    clients.delete(ws);
  });
});

// Обработка поисковых запросов
function handleSearchRequest(ws, message) {
  const { query, category } = message.data;
  console.log(`🔍 Поиск: "${query}" в категории: ${category}`);
  
  // Симуляция поиска с задержкой
  setTimeout(() => {
    const results = mockVacancies.filter(vacancy => 
      vacancy.title.toLowerCase().includes(query.toLowerCase()) ||
      vacancy.text.toLowerCase().includes(query.toLowerCase())
    );
    
    ws.send(JSON.stringify({
      type: 'search:results',
      data: {
        query,
        results: results.slice(0, 5), // Максимум 5 результатов
        total: results.length
      }
    }));
  }, 200 + Math.random() * 300); // Случайная задержка 200-500ms
}

// Симуляция новых вакансий каждые 30 секунд
setInterval(() => {
  if (clients.size === 0) return;
  
  const randomVacancy = mockVacancies[Math.floor(Math.random() * mockVacancies.length)];
  const newVacancy = {
    ...randomVacancy,
    id: Date.now() + Math.random(),
    timestamp: new Date().toISOString(),
    is_new: true
  };
  
  console.log('📢 Отправка новой вакансии:', newVacancy.title);
  
  // Отправляем всем подключенным клиентам
  const message = JSON.stringify({
    type: 'vacancy:new',
    data: newVacancy
  });
  
  clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
  
}, 30000); // Каждые 30 секунд

// HTTP endpoint для проверки статуса
app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    clients: clients.size,
    timestamp: new Date().toISOString()
  });
});

// Запуск сервера
const PORT = process.env.WS_PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Mock WebSocket Server запущен на порту ${PORT}`);
  console.log(`📡 WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`🌐 HTTP Status: http://localhost:${PORT}/status`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Завершение работы сервера...');
  server.close(() => {
    console.log('✅ Сервер остановлен');
    process.exit(0);
  });
});