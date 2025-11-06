/**
 * Request Queue Manager - для управления параллельными API запросами
 * Предотвращает race conditions и overload сервера
 */

class RequestQueue {
  constructor(name = 'default', concurrency = 1) {
    this.name = name;
    this.concurrency = concurrency;
    this.queue = [];
    this.executing = [];
    this.metrics = {
      total: 0,
      completed: 0,
      failed: 0,
      avgTime: 0
    };

    console.log(`[RequestQueue] Создана очередь "${name}" с параллелизмом ${concurrency}`);
  }

  /**
   * Добавить запрос в очередь
   */
  async enqueue(task, label = 'unknown') {
    return new Promise((resolve, reject) => {
      const request = {
        task,
        label,
        timestamp: Date.now(),
        resolve,
        reject
      };

      this.queue.push(request);
      this.metrics.total++;

      console.log(
        `[RequestQueue "${this.name}"] Запрос добавлен: ${label} (очередь: ${this.queue.length}, выполняется: ${this.executing.length})`
      );

      this.processQueue();
    });
  }

  /**
   * Обработка очереди
   */
  async processQueue() {
    // Ограничиваем одновременное выполнение по значению concurrency
    while (this.executing.length < this.concurrency && this.queue.length > 0) {
      const request = this.queue.shift();
      await this.executeRequest(request);
    }
  }

  /**
   * ✅ RACE CONDITION FIX: Выполнить запрос с безопасным обновлением метрик
   * Использует атомарные операции для update metrics и array removal
   */
  async executeRequest(request) {
    const { task, label, timestamp, resolve, reject } = request;
    const startTime = Date.now();

    this.executing.push(request);

    try {
      console.log(
        `[RequestQueue "${this.name}"] Выполняется: ${label} (${this.executing.length}/${this.concurrency} slots)`
      );

      // Выполняем задачу
      const result = await task();
      const duration = Date.now() - startTime;

      // ✅ RACE CONDITION FIX: Atomic metric update + array removal
      // Выполняем обновления вместе перед любым await
      this.metrics.completed++;
      this.updateAvgTime(duration);

      console.log(
        `[RequestQueue "${this.name}"] ✅ Завершено: ${label} (${duration}ms)`
      );

      // ✅ RACE CONDITION FIX: Безопасное удаление из executing используя indexOf
      const index = this.executing.indexOf(request);
      if (index !== -1) {
        this.executing.splice(index, 1);
      }

      // Обрабатываем следующий запрос
      this.processQueue();

      resolve(result);
    } catch (error) {
      const duration = Date.now() - startTime;

      // ✅ RACE CONDITION FIX: Atomic failure metric update
      this.metrics.failed++;

      console.error(
        `[RequestQueue "${this.name}"] ❌ Ошибка: ${label} (${duration}ms)`,
        error
      );

      // ✅ RACE CONDITION FIX: Безопасное удаление из executing используя indexOf
      const index = this.executing.indexOf(request);
      if (index !== -1) {
        this.executing.splice(index, 1);
      }

      // Обрабатываем следующий запрос
      this.processQueue();

      reject(error);
    }
  }

  /**
   * Обновить среднее время выполнения
   */
  updateAvgTime(duration) {
    // Используем экспоненциально взвешенное среднее для более актуальных данных
    if (this.metrics.avgTime === 0) {
      this.metrics.avgTime = duration;
    } else {
      this.metrics.avgTime = this.metrics.avgTime * 0.7 + duration * 0.3;
    }
  }

  /**
   * ✅ RACE CONDITION FIX: Получить безопасную копию статистики
   * Возвращает снимок данных, избегая проблем с частичным обновлением metrics
   */
  getStats() {
    // ✅ Создаем безопасную копию metrics перед использованием
    const metricsSnapshot = {
      total: this.metrics.total,
      completed: this.metrics.completed,
      failed: this.metrics.failed,
      avgTime: Math.round(this.metrics.avgTime * 10) / 10 // Округляем для безопасности
    };

    // ✅ Вычисляем successRate используя snapshotted значения
    const successRate = metricsSnapshot.total > 0
      ? ((metricsSnapshot.completed / metricsSnapshot.total) * 100).toFixed(1) + '%'
      : 'N/A';

    return {
      name: this.name,
      queueLength: this.queue.length,
      executing: this.executing.length,
      concurrency: this.concurrency,
      total: metricsSnapshot.total,
      completed: metricsSnapshot.completed,
      failed: metricsSnapshot.failed,
      avgTime: metricsSnapshot.avgTime,
      successRate: successRate
    };
  }

  /**
   * Очистить очередь (но не прерывать выполняющиеся запросы)
   */
  clear() {
    const clearedCount = this.queue.length;
    this.queue = [];
    console.log(`[RequestQueue "${this.name}"] Очередь очищена (${clearedCount} запросов отменено)`);
  }

  /**
   * Дождаться завершения всех запросов
   */
  async waitAll() {
    while (this.queue.length > 0 || this.executing.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    console.log(`[RequestQueue "${this.name}"] Все запросы завершены`);
  }
}

// Глобальный экспорт
window.RequestQueue = RequestQueue;

// Создаем предзаготовленные очереди для частых операций
window.apiQueue = new RequestQueue('api', 2); // 2 одновременных запроса
window.searchQueue = new RequestQueue('search', 1); // 1 поиск за раз
window.statusQueue = new RequestQueue('status', 3); // 3 обновления статуса одновременно

console.log('[Request Queue] Инициализирован с стандартными очередями');
