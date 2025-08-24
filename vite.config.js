import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages конфигурация
  base: '/oshu_work/',
  
  // Отключаем обработку HTML как модулей
  publicDir: false,
  
  build: {
    // Современная сборка для быстрых браузеров
    target: 'es2022',
    
    // Копируем HTML файлы как есть, не как модули
    rollupOptions: {
      // Исключаем HTML из bundling
      external: ['*.html'],
      
      // Мульти-страничное приложение - только JS entry points
      input: {
        main: 'main.js',
        favorites: 'favorites.js',
        settings: 'settings.js'
      }
    },
    
    // Минификация
    minify: 'esbuild',
    
    // Не генерировать manifest
    manifest: false
  },
  
  // Настройки dev сервера
  server: {
    port: 3000,
    open: true
  }
})