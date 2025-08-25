// Service Worker для oshu://work v1.0
// Офлайн режим для Telegram мини-аппа

const CACHE_NAME = 'oshu-work-v1';
const STATIC_CACHE = 'oshu-work-static-v1';
const DYNAMIC_CACHE = 'oshu-work-dynamic-v1';

// Base path для GitHub Pages
const BASE_PATH = '/oshu_work';

// Критические ресурсы для офлайн работы
const STATIC_ASSETS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/favorites.html`, 
  `${BASE_PATH}/settings.html`,
  `${BASE_PATH}/main.js`,
  `${BASE_PATH}/favorites.js`,
  `${BASE_PATH}/settings.js`,
  `${BASE_PATH}/src/css/style.css`,
  `${BASE_PATH}/src/css/critical.css`,
  `${BASE_PATH}/src/css/retro-settings.css`,
  `${BASE_PATH}/src/js/config.js`,
  `${BASE_PATH}/src/js/app-controller.js`,
  `${BASE_PATH}/src/js/state-manager.js`,
  `${BASE_PATH}/src/js/dom-manager.js`,
  `${BASE_PATH}/src/js/theme-manager.js`,
  `${BASE_PATH}/src/js/vacancy-manager.js`,
  `${BASE_PATH}/src/js/event-manager.js`,
  `${BASE_PATH}/src/js/template-loader.js`,
  `${BASE_PATH}/src/js/utils.min.js`,
  `${BASE_PATH}/src/html/vacancy-card-template.html`,
  `${BASE_PATH}/src/html/skeleton-template.html`
];

// CDN ресурсы с фолбэком
const CDN_FALLBACKS = [
  'https://unpkg.com/interactjs/dist/interact.min.js',
  'https://cdn.jsdelivr.net/npm/interactjs/dist/interact.min.js'
];

// Установка Service Worker
self.addEventListener('install', event => {
  console.log('🔧 Service Worker установлен');
  
  event.waitUntil(
    Promise.all([
      // Кэшируем статические файлы
      caches.open(STATIC_CACHE).then(cache => {
        return cache.addAll(STATIC_ASSETS);
      }),
      // Предзагружаем CDN
      caches.open(DYNAMIC_CACHE).then(cache => {
        return Promise.allSettled(
          CDN_FALLBACKS.map(url => cache.add(url))
        );
      })
    ]).then(() => {
      // Принудительно активируем новый SW
      return self.skipWaiting();
    })
  );
});

// Активация Service Worker
self.addEventListener('activate', event => {
  console.log('✅ Service Worker активирован');
  
  event.waitUntil(
    Promise.all([
      // Очищаем старые кэши
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (![STATIC_CACHE, DYNAMIC_CACHE].includes(cacheName)) {
              console.log('🗑️ Удаляю старый кэш:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Захватываем управление всеми страницами
      self.clients.claim()
    ])
  );
});

// Стратегии кэширования
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Игнорируем Telegram WebApp API запросы
  if (url.hostname === 'telegram.org') {
    return;
  }
  
  // Supabase API - Network First (всегда пытаемся получить свежие данные)
  if (url.hostname.includes('supabase')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }
  
  // CDN библиотеки - Cache First с фолбэком
  if (CDN_FALLBACKS.some(cdn => request.url.includes(new URL(cdn).hostname))) {
    event.respondWith(cacheFirstWithFallback(request));
    return;
  }
  
  // Статические ресурсы - Cache First
  if (isStaticAsset(request.url)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }
  
  // HTML страницы - Network First с офлайн фолбэком
  if (request.destination === 'document') {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }
  
  // Остальное - Network First
  event.respondWith(networkFirstStrategy(request));
});

// Cache First - для статических ресурсов
async function cacheFirstStrategy(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('❌ Cache First ошибка:', error);
    return new Response('Офлайн: Ресурс недоступен', { 
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Network First - для API и динамических данных
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('🔄 Network недоступен, ищу в кэше:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('Офлайн: Данные недоступны', {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Network First с офлайн страницей для HTML
async function networkFirstWithOfflineFallback(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('🔄 HTML страница недоступна, показываю кэш');
  }
  
  // Пытаемся найти в кэше
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Показываем главную страницу как фолбэк
  const indexResponse = await caches.match(`${BASE_PATH}/index.html`);
  if (indexResponse) {
    return indexResponse;
  }
  
  // Последний фолбэк - минимальная офлайн страница
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>oshu://work - Офлайн</title>
      <style>
        body { font-family: 'Roboto Mono', monospace; text-align: center; padding: 50px; }
        .offline { color: #FF5C5C; border: 2px solid #FF5C5C; padding: 20px; }
      </style>
    </head>
    <body>
      <div class="offline">
        <h1>📱 oshu://work</h1>
        <p>Приложение работает в офлайн режиме</p>
        <button onclick="location.reload()">Обновить</button>
      </div>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Cache First с CDN фолбэком
async function cacheFirstWithFallback(request) {
  try {
    // Сначала ищем в кэше
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Пытаемся загрузить по основному URL
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        const cache = await caches.open(DYNAMIC_CACHE);
        cache.put(request, networkResponse.clone());
        return networkResponse;
      }
    } catch (networkError) {
      console.log('🔄 Основной CDN недоступен, пробую фолбэк');
    }
    
    // Пробуем альтернативные CDN
    for (const fallbackUrl of CDN_FALLBACKS) {
      if (request.url !== fallbackUrl) {
        try {
          const fallbackResponse = await fetch(fallbackUrl);
          if (fallbackResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, fallbackResponse.clone());
            return fallbackResponse;
          }
        } catch (fallbackError) {
          console.log('🔄 Фолбэк CDN недоступен:', fallbackUrl);
        }
      }
    }
    
    throw new Error('Все CDN недоступны');
  } catch (error) {
    console.error('❌ CDN фолбэк ошибка:', error);
    return new Response('Библиотека недоступна в офлайн режиме', {
      status: 503,
      headers: { 'Content-Type': 'text/javascript' }
    });
  }
}

// Проверка статических ресурсов
function isStaticAsset(url) {
  return STATIC_ASSETS.some(asset => url.includes(asset)) ||
         url.includes('.css') ||
         url.includes('.js') ||
         url.includes('.html');
}

// Уведомления об обновлениях
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('📱 oshu://work Service Worker готов к работе!');