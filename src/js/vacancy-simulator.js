/**
 * Vacancy Simulator - эмуляция поступления новых вакансий
 * Для демонстрации real-time функций когда WebSocket сервер недоступен
 */

class VacancySimulator {
  constructor() {
    this.isActive = false;
    this.intervalId = null;
    this.mockCounter = 0;
    
    // Mock данные для симуляции
    this.mockVacancies = [
      {
        category: 'ТОЧНО ТВОЁ',
        summaries: [
          '🚀 Senior React Developer в стартапе (React + TypeScript)',
          '⚡ Frontend Lead в EdTech (React + GraphQL)', 
          '🎯 React Native разработчик (iOS + Android)',
          '💎 Full-stack React Developer (MERN stack)',
        ],
        channels: ['StartupJobs', 'ReactDevs', 'Frontend Focus'],
        skills: [
          ['React', 'TypeScript', 'Redux'],
          ['GraphQL', 'Apollo', 'React'],
          ['React Native', 'iOS', 'Android'],
          ['MongoDB', 'Express', 'React', 'Node.js']
        ]
      },
      {
        category: 'МОЖЕТ БЫТЬ',
        summaries: [
          '💼 Full-stack JavaScript Developer (удаленно)',
          '🌐 Vue.js Developer в продуктовой компании',
          '📱 Mobile Developer (Flutter/React Native)',
          '⚙️ DevOps Engineer с опытом Docker'
        ],
        channels: ['RemoteWork', 'VueJobs', 'DevOps Channel'],
        skills: [
          ['JavaScript', 'Node.js', 'PostgreSQL'],
          ['Vue.js', 'Vuex', 'Nuxt.js'],
          ['Flutter', 'Dart', 'React Native'],
          ['Docker', 'Kubernetes', 'AWS']
        ]
      },
      {
        category: 'НЕ ТВОЁ',
        summaries: [
          '📊 Data Analyst с опытом SQL и Excel',
          '💰 Менеджер по продажам (B2B сегмент)',
          '🎨 UI/UX дизайнер для мобильных приложений',
          '📝 Контент-менеджер для социальных сетей'
        ],
        channels: ['DataJobs', 'Sales Pro', 'Design Team', 'Content Hub'],
        skills: [
          ['SQL', 'Excel', 'PowerBI'],
          ['CRM', 'Переговоры', 'B2B'],
          ['Figma', 'Sketch', 'Principle'],
          ['SMM', 'Копирайтинг', 'Аналитика']
        ]
      }
    ];
  }
  
  /**
   * Запуск симулятора
   */
  start() {
    if (this.isActive) {
      return;
    }
    
    // Симулятор запущен
    this.isActive = true;
    
    // Генерируем новые вакансии каждые 45 секунд
    this.intervalId = setInterval(() => {
      this.generateNewVacancy();
    }, 45000);
    
    // Первую вакансию генерируем через 10 секунд после запуска
    setTimeout(() => {
      this.generateNewVacancy();
    }, 10000);
  }
  
  /**
   * Остановка симулятора
   */
  stop() {
    if (!this.isActive) {
      return;
    }
    
    // Симулятор остановлен
    this.isActive = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  /**
   * Генерация новой mock вакансии
   */
  generateNewVacancy() {
    const categoryData = this.getRandomCategory();
    const summaryIndex = Math.floor(Math.random() * categoryData.summaries.length);
    
    this.mockCounter++;
    
    const newVacancy = {
      id: `simulator-${Date.now()}-${this.mockCounter}`,
      category: categoryData.category,
      summary: `🔥 НОВАЯ: ${categoryData.summaries[summaryIndex]}`,
      channel: categoryData.channels[Math.floor(Math.random() * categoryData.channels.length)],
      timestamp: Date.now(),
      skills: categoryData.skills[summaryIndex] || ['JavaScript'],
      salary: this.generateRandomSalary(),
      isNew: true,
      isSimulated: true // Помечаем как симулированную
    };
    
    // Генерация новой вакансии
    
    // Отправляем событие как будто пришло от WebSocket
    console.log('📡 [Vacancy Simulator] Отправка события vacancy:new:', {
      title: newVacancy.title,
      category: newVacancy.category,
      id: newVacancy.id
    });
    
    const event = new CustomEvent('vacancy:new', {
      detail: newVacancy,
      bubbles: true
    });
    
    document.dispatchEvent(event);
    console.log('✅ [Vacancy Simulator] Событие vacancy:new отправлено');
  }
  
  /**
   * Выбор случайной категории с распределением по важности
   */
  getRandomCategory() {
    const chance = Math.random();
    
    // 50% - ТОЧНО ТВОЁ, 30% - МОЖЕТ БЫТЬ, 20% - НЕ ТВОЁ
    if (chance < 0.5) {
      return this.mockVacancies[0]; // ТОЧНО ТВОЁ
    } else if (chance < 0.8) {
      return this.mockVacancies[1]; // МОЖЕТ БЫТЬ
    } else {
      return this.mockVacancies[2]; // НЕ ТВОЁ
    }
  }
  
  /**
   * Генерация случайной зарплаты
   */
  generateRandomSalary() {
    const minSalary = 100 + Math.floor(Math.random() * 150); // 100-250к
    const maxSalary = minSalary + 50 + Math.floor(Math.random() * 100); // +50-150к
    
    return `${minSalary}-${maxSalary}к ₽`;
  }
  
  /**
   * Получение статистики симулятора
   */
  getStats() {
    return {
      active: this.isActive,
      generated: this.mockCounter,
      uptime: this.isActive ? Date.now() - this.startTime : 0
    };
  }
}

// Глобальный экспорт
window.VacancySimulator = VacancySimulator;

// Создаем глобальный экземпляр
window.vacancySimulator = new VacancySimulator();

// Vacancy Simulator инициализирован