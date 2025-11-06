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
   * Выполнить запрос
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

      this.metrics.completed++;
      this.updateAvgTime(duration);

      console.log(
        `[RequestQueue "${this.name}"] ✅ Завершено: ${label} (${duration}ms)`
      );

      // Удаляем из executing
      this.executing = this.executing.filter((r) => r !== request);

      // Обрабатываем следующий запрос
      this.processQueue();

      resolve(result);
    } catch (error) {
      const duration = Date.now() - startTime;

      this.metrics.failed++;

      console.error(
        `[RequestQueue "${this.name}"] ❌ Ошибка: ${label} (${duration}ms)`,
        error
      );

      // Удаляем из executing
      this.executing = this.executing.filter((r) => r !== request);

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
   * Получить статистику
   */
  getStats() {
    return {
      name: this.name,
      queueLength: this.queue.length,
      executing: this.executing.length,
      concurrency: this.concurrency,
      ...this.metrics,
      successRate: this.metrics.total > 0
        ? ((this.metrics.completed / this.metrics.total) * 100).toFixed(1) + '%'
        : 'N/A'
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
