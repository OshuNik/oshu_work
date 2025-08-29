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
    const criticalAssets = [
      '/oshu_work/src/css/critical.css',
      '/oshu_work/src/css/style.css',
      '/oshu_work/src/js/config.js',
      '/oshu_work/src/js/constants.js',
      '/oshu_work/favicon.ico'
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

  cacheJobData(query, jobs, type = 'search') {
    const cacheKey = this.generateJobCacheKey(query, type);
    const cacheData = {
      data: jobs,
      timestamp: Date.now(),
      ttl: type === 'search' ? this.SEARCH_CACHE_TIME : this.DATA_CACHE_TIME,
      query: query,
      count: jobs.length
    };

    try {
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log(`📦 Закэшированы данные для "${query}": ${jobs.length} вакансий`);
    } catch (error) {
      console.warn('⚠️ Не удалось закэшировать данные вакансий:', error);
    }
  }

  getCachedJobData(query, type = 'search') {
    const cacheKey = this.generateJobCacheKey(query, type);
    
    try {
      const cachedDataStr = localStorage.getItem(cacheKey);
      if (!cachedDataStr) return null;

      const cachedData = JSON.parse(cachedDataStr);
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

  generateJobCacheKey(query, type) {
    const cleanQuery = typeof query === 'string' ? query : JSON.stringify(query);
    return `job-${type}-${btoa(cleanQuery).slice(0, 20)}-${Date.now().toString().slice(-6)}`;
  }

  // =================
  // ИЗБРАННЫЕ
  // =================

  cacheFavorites(favorites) {
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

      const cachedData = JSON.parse(cachedDataStr);
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

      const cachedData = JSON.parse(cachedDataStr);
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
      // Здесь будет реальный API endpoint
      const url = `/api/jobs?page=${page}&limit=20`;
      const response = await fetch(url, { cache: 'no-cache' });
      
      if (response.ok) {
        const data = await response.json();
        this.cacheJobData(`page-${page}`, data.jobs, 'prefetch');
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
            const data = JSON.parse(localStorage.getItem(key));
            stats.favoritesCount = data.count || 0;
          } catch (e) {}
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