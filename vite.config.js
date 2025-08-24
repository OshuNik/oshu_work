import { defineConfig } from 'vite'

export default defineConfig({
  // Копируем статические файлы в dist
  publicDir: false, // Отключаем автокопирование из public/
  
  // Копируем нужные статические ресурсы
  assetsInclude: ['**/*.js', '**/*.css', '**/*.html'],
  // GitHub Pages конфигурация
  base: '/oshu_work/',
  
  build: {
    // Современная сборка для быстрых браузеров
    target: 'es2022',
    
    // Настройки сборки
    rollupOptions: {
      // Мульти-страничное приложение
      input: {
        main: 'index.html',
        favorites: 'favorites.html', 
        settings: 'settings.html'
      },
      
      output: {
        // Оптимальное разделение чанков
        manualChunks(id) {
          // Группируем по размеру и назначению
          if (id.includes('src/modules/')) {
            return 'settings-modules';
          }
          // Остальные модули пусть Vite сам решает
        }
      }
    },
    
    // Минификация - упрощенная для избежания проблем
    minify: 'esbuild'
  },
  
  // Настройки dev сервера
  server: {
    port: 3000,
    open: true
  }
})