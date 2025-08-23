import { defineConfig } from 'vite'

export default defineConfig({
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
        manualChunks: {
          // Крупные модули выносим в отдельные чанки
          'utils': ['src/js/utils.min.js'],
          'settings-modules': ['src/modules/SettingsMain.js']
        }
      }
    },
    
    // Минификация
    minify: 'terser',
    terserOptions: {
      compress: {
        // Сохраняем console.log для отладки в Telegram
        drop_console: false,
        drop_debugger: true
      }
    }
  },
  
  // Настройки dev сервера
  server: {
    port: 3000,
    open: true
  }
})