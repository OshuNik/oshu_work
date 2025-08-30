/**
 * Mock WebSocket Server для разработки Phase 3.2
 * Эмулирует real-time события для тестирования
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = createServer(app);

// Настройка CORS для локальной разработки
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:4176", "http://127.0.0.1:4176"],
    methods: ["GET", "POST"],
    credentials: false
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Mock данные вакансий
const mockVacancies = [
  {
    id: 'mock_1',
    title: 'Frontend Developer',
    company: 'Tech Corp',
    category: 'ТОЧНО ТВОЁ',
    salary: '150-200k',
    description: 'React, TypeScript, Node.js разработчик для интересных проектов',
    skills: ['React', 'TypeScript', 'WebSocket'],
    timestamp: Date.now()
  },
  {
    id: 'mock_2', 
    title: 'Full-stack Developer',
    company: 'StartupXYZ',
    category: 'МОЖЕТ БЫТЬ',
    salary: '120-180k',
    description: 'Python/Django + React разработчик',
    skills: ['Python', 'Django', 'React'],
    timestamp: Date.now()
  }
];

// Состояние сервера
const rooms = {
  'main-vacancies': new Set(),
  'maybe-vacancies': new Set(), 
  'other-vacancies': new Set()
};

console.log('🚀 Mock WebSocket Server запускается...');

io.on('connection', (socket) => {
  console.log('✅ Клиент подключен:', socket.id);
  
  // Подписка на room
  socket.on('join_room', (roomName) => {
    socket.join(roomName);
    if (rooms[roomName]) {
      rooms[roomName].add(socket.id);
    }
    console.log(`📥 ${socket.id} подписался на room: ${roomName}`);
    
    // Подтверждение подписки
    socket.emit('room_joined', { room: roomName, success: true });
  });
  
  // Отписка от room
  socket.on('leave_room', (roomName) => {
    socket.leave(roomName);
    if (rooms[roomName]) {
      rooms[roomName].delete(socket.id);
    }
    console.log(`📤 ${socket.id} отписался от room: ${roomName}`);
  });
  
  // Real-time поиск
  socket.on('search:query', (data) => {
    console.log('🔍 Поисковый запрос:', data);
    
    // Эмулируем задержку поиска
    setTimeout(() => {
      const results = mockVacancies.filter(vacancy => 
        vacancy.title.toLowerCase().includes(data.query.toLowerCase()) ||
        vacancy.company.toLowerCase().includes(data.query.toLowerCase()) ||
        vacancy.description.toLowerCase().includes(data.query.toLowerCase())
      ).slice(0, data.limit || 10);
      
      socket.emit('search:results', {
        query: data.query,
        results: results,
        total: results.length,
        timestamp: Date.now()
      });
    }, 100 + Math.random() * 200); // 100-300ms задержка
  });
  
  // Отключение клиента
  socket.on('disconnect', (reason) => {
    console.log('❌ Клиент отключен:', socket.id, reason);
    
    // Удаляем из всех room'ов
    Object.values(rooms).forEach(roomSet => {
      roomSet.delete(socket.id);
    });
  });
});

// Генерация случайных событий для демонстрации
function generateRandomEvents() {
  const eventTypes = ['new', 'updated', 'deleted'];
  const categories = ['main-vacancies', 'maybe-vacancies', 'other-vacancies'];
  
  setInterval(() => {
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];
    
    if (Math.random() < 0.3) { // 30% вероятность события каждые 10 секунд
      let eventData = {};
      
      switch (eventType) {
        case 'new':
          eventData = {
            ...mockVacancies[Math.floor(Math.random() * mockVacancies.length)],
            id: `mock_new_${Date.now()}`,
            timestamp: Date.now(),
            isNew: true
          };
          
          io.to(category).emit('vacancy:new', eventData);
          console.log(`📢 Отправлено vacancy:new в ${category}:`, eventData.title);
          break;
          
        case 'updated':
          const updatedVacancy = {
            ...mockVacancies[0],
            salary: `${120 + Math.floor(Math.random() * 100)}-${180 + Math.floor(Math.random() * 120)}k`,
            timestamp: Date.now(),
            isUpdated: true
          };
          
          io.to(category).emit('vacancy:updated', updatedVacancy);
          console.log(`📢 Отправлено vacancy:updated в ${category}:`, updatedVacancy.title);
          break;
          
        case 'deleted':
          eventData = {
            id: 'mock_1',
            reason: 'position_filled',
            timestamp: Date.now()
          };
          
          io.to(category).emit('vacancy:deleted', eventData);
          console.log(`📢 Отправлено vacancy:deleted в ${category}:`, eventData.id);
          break;
      }
    }
  }, 10000); // Каждые 10 секунд
}

// Запуск генерации событий
setTimeout(generateRandomEvents, 5000); // Начинаем через 5 секунд после запуска

// REST API для тестирования
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    connections: io.engine.clientsCount,
    rooms: Object.fromEntries(
      Object.entries(rooms).map(([name, clients]) => [name, clients.size])
    ),
    uptime: process.uptime()
  });
});

// Ручная отправка события для тестирования
app.post('/api/send-event', (req, res) => {
  const { eventType, room, data } = req.body;
  
  if (eventType && room && data) {
    io.to(room).emit(eventType, data);
    
    res.json({
      success: true,
      message: `Событие ${eventType} отправлено в room ${room}`,
      data
    });
    
    console.log(`📤 API: Отправлено ${eventType} в ${room}:`, data);
  } else {
    res.status(400).json({
      success: false,
      message: 'Требуются параметры: eventType, room, data'
    });
  }
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`✅ Mock WebSocket Server запущен на порту ${PORT}`);
  console.log(`📊 Status API: http://localhost:${PORT}/api/status`);
  console.log(`🎮 Manual events: POST http://localhost:${PORT}/api/send-event`);
  console.log('');
  console.log('🔗 Подключение клиента: http://localhost:3001');
  console.log('📱 Тестовый клиент: http://localhost:4176');
});

// Обработка завершения процесса
process.on('SIGINT', () => {
  console.log('🛑 Остановка Mock WebSocket Server...');
  server.close(() => {
    console.log('✅ Mock WebSocket Server остановлен');
    process.exit(0);
  });
});