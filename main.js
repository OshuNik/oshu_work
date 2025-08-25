// main.js - entry point для index.html
// НЕ импортируем CSS - он уже подключен в HTML!

console.log('📦 Vite: Main entry point loaded')

// Service Worker регистрация для PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker зарегистрирован:', registration);
      
      // Обновление SW
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Показываем уведомление об обновлении
              console.log('🔄 Доступно обновление приложения');
              if (confirm('Доступно обновление приложения. Перезагрузить?')) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            }
          });
        }
      });
      
    } catch (error) {
      console.error('❌ Service Worker регистрация не удалась:', error);
    }
  });
}

// Vite автоматически подгрузит скрипты из HTML
// Ничего больше не делаем - оставляем как есть