/**
 * Smart Cache Manager для Telegram Mini App
 * Кэширование для быстрого старта приложения
 */

class SmartCacheManager {
  constructor() {
    this.CACHE_NAME = 'telegram-oshu-work-v14';
    this.STATIC_CACHE_TIME = 7 * 24 * 60 * 60 * 1000; // 7 дней
    this.DATA_CACHE_TIME = 5 * 60 * 1000; // 5 минут для данных
    this.SEARCH_CACHE_TIME = 2 * 60 * 1000; // 2 минуты для поиска

    // ✅ FIX: Добавлен лимит на размер кэша
    this.MAX_CACHE_SIZE = 5 * 1024 * 1024; // 5 МБ максимум для кэша данных
    this.MAX_CACHE_ENTRIES = 50; // Максимум 50 записей кэша
    this.cacheEntries = []; // Отслеживаем порядок записей для FIFO удаления

    this.isSupported = 'caches' in window;
    this.init();
  }

  async init() {
    if (!this.isSupported) {
      console.warn('Cache API не поддерживается');
      return;
    }

    try {
      // Проверяем доступность кэша
      await caches.open(this.CACHE_NAME);
      
      // Очищаем устаревшие кэши
      await this.cleanOldCaches();
      
      // Предзагружаем критические ресурсы
      await this.preloadCriticalAssets();
      
      console.log('✅ Smart Cache Manager готов');
    } catch (error) {
      console.error('❌ Ошибка инициализации Smart Cache:', error);
    }
  }

  // ===================
  // СТАТИЧЕСКИЕ РЕСУРСЫ
  // ===================

  async preloadCriticalAssets() {
    // Только статические ресурсы (JS/CSS загружаются автоматически)
    const criticalAssets = [
      '/oshu_work/favicon.ico',
      '/oshu_work/favicon.svg'
    ];

    try {
      const cache = await caches.open(this.CACHE_NAME);
      
      // Проверяем какие ресурсы уже закэшированы
      const cachedUrls = await cache.keys();
      const cachedUrlStrings = cachedUrls.map(req => req.url);
      
      // Кэшируем только недостающие ресурсы
      const missingAssets = criticalAssets.filter(asset => {
        const fullUrl = new URL(asset, window.location.origin).href;
        return !cachedUrlStrings.includes(fullUrl);
      });

      if (missingAssets.length > 0) {
        await cache.addAll(missingAssets);
        console.log(`📦 Закэшировано ${missingAssets.length} критических ресурсов`);
      }
    } catch (error) {
      console.warn('⚠️ Не удалось предзагрузить критические ресурсы:', error);
    }
  }

  async cacheStaticAsset(url, response) {
    if (!this.isSupported) return;

    try {
      const cache = await caches.open(this.CACHE_NAME);
      await cache.put(url, response.clone());
    } catch (error) {
      console.warn('⚠️ Не удалось закэшировать статический ресурс:', error);
    }
  }

  async getStaticAsset(url) {
    if (!this.isSupported) return null;

    try {
      const cache = await caches.open(this.CACHE_NAME);
      return await cache.match(url);
    } catch (error) {
      console.warn('⚠️ Не удалось получить из кэша:', error);
      return null;
    }
  }

  // ==================
  // ДАННЫЕ ВАКАНСИЙ
  // ==================

  /**
   * ✅ FIX: Simple hash function for stable cache keys without timestamps
   * Prevents cache collisions by using query content instead of timestamp
   */
  simpleHash(str) {
    let hash = 0;
    if (!str || typeof str !== 'string') return '0';
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  cacheJobData(query, jobs, type = 'search') {
    const cacheKey = this.generateJobCacheKey(query, type);
    const cacheData = {
      data: jobs,
      timestamp: Date.now(),
      ttl: type === 'search' ? this.SEARCH_CACHE_TIME : this.DATA_CACHE_TIME,
      query: query,
      count: Array.isArray(jobs) ? jobs.length : 0
    };

    try {
      // ✅ FIX: Validate jobs is array before processing
      if (!Array.isArray(jobs)) {
        console.warn('⚠️ Jobs data is not an array:', typeof jobs);
        return;
      }

      // ✅ FIX: Проверяем размер кэша перед добавлением
      const dataString = JSON.stringify(cacheData);
      const dataSize = new Blob([dataString]).size;

      // Проверяем количество записей
      if (this.cacheEntries.length >= this.MAX_CACHE_ENTRIES) {
        const oldestKey = this.cacheEntries.shift();
        if (oldestKey) {
          localStorage.removeItem(oldestKey);
          console.log(`🗑️ Удалена старая запись кэша: ${oldestKey}`);
        }
      }

      // Проверяем общий размер (примерно)
      let totalSize = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('job-')) {
          const item = localStorage.getItem(key);
          totalSize += item ? item.length : 0;
        }
      }

      if (totalSize + dataSize > this.MAX_CACHE_SIZE) {
        // Удаляем самую старую запись и пробуем снова
        if (this.cacheEntries.length > 0) {
          const oldestKey = this.cacheEntries.shift();
          if (oldestKey) {
            localStorage.removeItem(oldestKey);
            console.log(`🗑️ Превышен размер кэша, удалена запись: ${oldestKey}`);
          }
        } else {
          console.warn('⚠️ Не удалось закэшировать - размер превышен');
          return;
        }
      }

      localStorage.setItem(cacheKey, dataString);
      this.cacheEntries.push(cacheKey);
      console.log(`📦 Закэшированы данные для "${query}": ${cacheData.count} вакансий (${Math.round(dataSize / 1024)}KB)`);
    } catch (error) {
      console.warn('⚠️ Не удалось закэшировать данные вакансий:', error);
    }
  }

  getCachedJobData(query, type = 'search') {
    const cacheKey = this.generateJobCacheKey(query, type);
    
    try {
      const cachedDataStr = localStorage.getItem(cacheKey);
      if (!cachedDataStr) return null;

      // ✅ FIX: Validate JSON parse and check structure
      let cachedData;
      try {
        cachedData = JSON.parse(cachedDataStr);
      } catch (parseError) {
        console.warn('⚠️ Invalid JSON in cache:', parseError.message);
        localStorage.removeItem(cacheKey);
        return null;
      }

      // ✅ FIX: Validate cache object structure
      if (!cachedData || typeof cachedData !== 'object') {
        console.warn('⚠️ Cache data has invalid structure');
        localStorage.removeItem(cacheKey);
        return null;
      }

      // ✅ FIX: Validate required fields exist and have correct types
      if (!Array.isArray(cachedData.data) || typeof cachedData.timestamp !== 'number' || typeof cachedData.ttl !== 'number') {
        console.warn('⚠️ Cache data missing required fields');
        localStorage.removeItem(cacheKey);
        return null;
      }

      const now = Date.now();

      // Проверяем TTL
      if (now - cachedData.timestamp > cachedData.ttl) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      console.log(`📦 Данные получены из кэша для "${query}": ${cachedData.count} вакансий`);
      return cachedData.data;
    } catch (error) {
      console.warn('⚠️ Не удалось получить данные из кэша:', error);
      return null;
    }
  }

  /**
   * ✅ FIX: Use content hash instead of timestamp to prevent collisions
   */
  generateJobCacheKey(query, type) {
    if (!query) {
      return `job-${type}-empty`;
    }

    // Convert query to string safely
    const queryStr = typeof query === 'string' ? query : JSON.stringify(query);
    
    // Use hash of query content instead of timestamp
    const queryHash = this.simpleHash(queryStr);
    
    return `job-${type}-${queryHash}`;
  }

  // =================
  // ИЗБРАННЫЕ
  // =================

  cacheFavorites(favorites) {
    // ✅ FIX: Validate favorites is array
    if (!Array.isArray(favorites)) {
      console.warn('⚠️ Favorites is not an array:', typeof favorites);
      return;
    }

    const cacheData = {
      data: favorites,
      timestamp: Date.now(),
      count: favorites.length
    };

    try {
      localStorage.setItem('favorites-cache', JSON.stringify(cacheData));
      console.log(`💖 Закэшировано ${favorites.length} избранных вакансий`);
    } catch (error) {
      console.warn('⚠️ Не удалось закэшировать избранное:', error);
    }
  }

  getCachedFavorites() {
    try {
      const cachedDataStr = localStorage.getItem('favorites-cache');
      if (!cachedDataStr) return null;

      // ✅ FIX: Validate JSON and structure
      let cachedData;
      try {
        cachedData = JSON.parse(cachedDataStr);
      } catch (parseError) {
        console.warn('⚠️ Invalid JSON in favorites cache:', parseError.message);
        localStorage.removeItem('favorites-cache');
        return null;
      }

      // ✅ FIX: Validate structure before using
      if (!cachedData || typeof cachedData !== 'object' || !Array.isArray(cachedData.data)) {
        console.warn('⚠️ Favorites cache has invalid structure');
        localStorage.removeItem('favorites-cache');
        return null;
      }

      console.log(`💖 Избранное получено из кэша: ${cachedData.count} вакансий`);
      return cachedData.data;
    } catch (error) {
      console.warn('⚠️ Не удалось получить избранное из кэша:', error);
      return null;
    }
  }

  // =================
  // НАСТРОЙКИ
  // =================

  cacheSettings(settings) {
    // ✅ FIX: Validate settings is object
    if (!settings || typeof settings !== 'object') {
      console.warn('⚠️ Settings is not an object:', typeof settings);
      return;
    }

    try {
      localStorage.setItem('settings-cache', JSON.stringify({
        data: settings,
        timestamp: Date.now()
      }));
      console.log('⚙️ Настройки закэшированы');
    } catch (error) {
      console.warn('⚠️ Не удалось закэшировать настройки:', error);
    }
  }

  getCachedSettings() {
    try {
      const cachedDataStr = localStorage.getItem('settings-cache');
      if (!cachedDataStr) return null;

      // ✅ FIX: Validate JSON and structure
      let cachedData;
      try {
        cachedData = JSON.parse(cachedDataStr);
      } catch (parseError) {
        console.warn('⚠️ Invalid JSON in settings cache:', parseError.message);
        localStorage.removeItem('settings-cache');
        return null;
      }

      // ✅ FIX: Validate structure before using
      if (!cachedData || typeof cachedData !== 'object' || typeof cachedData.data !== 'object') {
        console.warn('⚠️ Settings cache has invalid structure');
        localStorage.removeItem('settings-cache');
        return null;
      }

      return cachedData.data;
    } catch (error) {
      console.warn('⚠️ Не удалось получить настройки из кэша:', error);
      return null;
    }
  }

  // ===================
  // NETWORK-FIRST FETCH
  // ===================

  async networkFirstFetch(url, options = {}) {
    const cacheKey = url;

    try {
      // Пытаемся получить из сети
      const networkResponse = await fetch(url, {
        ...options,
        cache: 'no-cache' // Всегда идем в сеть
      });

      if (networkResponse.ok) {
        // Кэшируем успешный ответ
        await this.cacheStaticAsset(cacheKey, networkResponse);
        return networkResponse.clone();
      }

      throw new Error(`Network response not ok: ${networkResponse.status}`);
    } catch (error) {
      console.warn('⚠️ Network fetch failed, trying cache:', error.message);
      
      // Если сеть недоступна, пытаемся получить из кэша
      const cachedResponse = await this.getStaticAsset(cacheKey);
      if (cachedResponse) {
        console.log('📦 Данные получены из кэша после ошибки сети');
        return cachedResponse;
      }

      throw error; // Если и кэш пуст, пробрасываем ошибку
    }
  }

  // ===================
  // CACHE-FIRST FETCH
  // ===================

  async cacheFirstFetch(url, options = {}) {
    const cacheKey = url;

    // Сначала проверяем кэш
    const cachedResponse = await this.getStaticAsset(cacheKey);
    if (cachedResponse) {
      console.log('📦 Статический ресурс получен из кэша');
      
      // В фоне обновляем кэш
      this.updateCacheInBackground(url, options);
      
      return cachedResponse;
    }

    // Если в кэше нет, идем в сеть
    try {
      const networkResponse = await fetch(url, options);
      
      if (networkResponse.ok) {
        await this.cacheStaticAsset(cacheKey, networkResponse);
      }
      
      return networkResponse;
    } catch (error) {
      console.error('❌ Ошибка получения ресурса:', error);
      throw error;
    }
  }

  async updateCacheInBackground(url, options = {}) {
    try {
      const networkResponse = await fetch(url, options);
      if (networkResponse.ok) {
        await this.cacheStaticAsset(url, networkResponse);
        console.log('🔄 Кэш обновлен в фоне для:', url);
      }
    } catch (error) {
      console.warn('⚠️ Не удалось обновить кэш в фоне:', error);
    }
  }

  // =================
  // PREFETCH
  // =================

  async prefetchJobPages(currentPage = 1, totalPages = 5) {
    const pagesToPrefetch = [];
    
    // Префетчим следующие 2-3 страницы
    for (let i = 1; i <= 3; i++) {
      const nextPage = currentPage + i;
      if (nextPage <= totalPages) {
        pagesToPrefetch.push(nextPage);
      }
    }

    console.log(`🔮 Префетчинг страниц: ${pagesToPrefetch.join(', ')}`);

    // Префетчим в фоне с задержкой
    pagesToPrefetch.forEach((page, index) => {
      setTimeout(() => {
        this.prefetchJobPage(page);
      }, index * 500); // Задержка между запросами
    });
  }

  async prefetchJobPage(page) {
    try {
      // ✅ FIX: Validate page is number
      if (!Number.isInteger(page) || page < 1) {
        console.warn('⚠️ Invalid page number:', page);
        return;
      }

      // Здесь будет реальный API endpoint
      const url = `/api/jobs?page=${page}&limit=20`;
      const response = await fetch(url, { cache: 'no-cache' });
      
      if (response.ok) {
        const data = await response.json();
        // ✅ FIX: Validate data.jobs is array
        if (Array.isArray(data.jobs)) {
          this.cacheJobData(`page-${page}`, data.jobs, 'prefetch');
        }
      }
    } catch (error) {
      console.warn(`⚠️ Не удалось префетчить страницу ${page}:`, error);
    }
  }

  // =================
  // УПРАВЛЕНИЕ КЭШЕМ
  // =================

  async cleanOldCaches() {
    if (!this.isSupported) return;

    try {
      const cacheNames = await caches.keys();
      const oldCacheNames = cacheNames.filter(name => 
        name.startsWith('telegram-oshu-work-') && name !== this.CACHE_NAME
      );

      await Promise.all(
        oldCacheNames.map(cacheName => caches.delete(cacheName))
      );

      if (oldCacheNames.length > 0) {
        console.log(`🧹 Удалены старые кэши: ${oldCacheNames.join(', ')}`);
      }
    } catch (error) {
      console.warn('⚠️ Не удалось очистить старые кэши:', error);
    }
  }

  clearJobDataCache() {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('job-'));
      keys.forEach(key => localStorage.removeItem(key));
      console.log(`🧹 Очищены данные вакансий: ${keys.length} записей`);
    } catch (error) {
      console.warn('⚠️ Не удалось очистить кэш данных:', error);
    }
  }

  async clearAllCaches() {
    try {
      // Очищаем Cache API
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));

      // Очищаем localStorage
      const keys = Object.keys(localStorage).filter(key => 
        key.includes('job-') || key.includes('favorites-') || key.includes('settings-')
      );
      keys.forEach(key => localStorage.removeItem(key));

      console.log('🧹 Все кэши очищены');
    } catch (error) {
      console.error('❌ Ошибка очистки кэшей:', error);
    }
  }

  // =================
  // СТАТИСТИКА
  // =================

  async getCacheStats() {
    const stats = {
      cacheSupported: this.isSupported,
      localStorageUsed: 0,
      cacheStorageUsed: 0,
      jobDataCached: 0,
      favoritesCount: 0
    };

    try {
      // LocalStorage статистика
      let totalSize = 0;
      let jobDataCount = 0;

      Object.keys(localStorage).forEach(key => {
        const size = localStorage.getItem(key)?.length || 0;
        totalSize += size;

        if (key.startsWith('job-')) jobDataCount++;
        if (key === 'favorites-cache') {
          try {
            const dataStr = localStorage.getItem(key);
            // ✅ FIX: Validate before parsing
            if (dataStr && typeof dataStr === 'string') {
              const data = JSON.parse(dataStr);
              // ✅ FIX: Validate structure
              if (data && typeof data === 'object' && typeof data.count === 'number') {
                stats.favoritesCount = data.count;
              }
            }
          } catch (e) {
            console.warn('⚠️ Ошибка парсинга favorites-cache:', e.message);
            stats.favoritesCount = 0;
          }
        }
      });

      stats.localStorageUsed = Math.round(totalSize / 1024); // KB
      stats.jobDataCached = jobDataCount;

      // Cache API статистика (приблизительная)
      if (this.isSupported) {
        const cache = await caches.open(this.CACHE_NAME);
        const cachedRequests = await cache.keys();
        stats.cacheStorageUsed = cachedRequests.length;
      }

    } catch (error) {
      console.warn('⚠️ Не удалось получить статистику кэша:', error);
    }

    return stats;
  }
}

// Глобальная инициализация
window.smartCache = new SmartCacheManager();

export default window.smartCache;