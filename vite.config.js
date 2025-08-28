import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve'
  const isProd = mode === 'production'
  
  return {
    // Base path для GitHub Pages
    base: isProd ? '/oshu_work/' : '/',
    
    // Настройки сервера разработки
    server: {
      port: 5173,
      host: true, // Позволяет доступ из сети (полезно для тестирования на мобильных)
      open: true,
      // HTTPS для тестирования Telegram Mini App
      https: false // включить при необходимости тестирования в Telegram
    },
    
    // Настройки превью
    preview: {
      port: 4173,
      host: true
    },
    
    // Конфигурация сборки
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      
      // Multi-page configuration
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          favorites: resolve(__dirname, 'favorites.html'),
          settings: resolve(__dirname, 'settings.html')
        },
        
        // Оптимизация для production
        output: {
          // Chunking стратегия для better caching
          manualChunks: {
            // Общие утилиты
            utils: [
              './src/js/utils.min.js',
              './src/js/constants.js',
              './src/js/config.js'
            ],
            // API и сеть
            api: [
              './src/js/api-service.js',
              './src/js/network-manager.js'
            ],
            // UI менеджеры
            ui: [
              './src/js/dom-manager.js',
              './src/js/theme-manager.js',
              './src/js/template-loader.js'
            ],
            // Бизнес логика
            core: [
              './src/js/state-manager.js',
              './src/js/vacancy-manager.js',
              './src/js/app-controller.js'
            ]
          }
        }
      },
      
      // Минификация
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: isProd, // Убираем console.log в production
          drop_debugger: isProd,
          pure_funcs: isProd ? ['console.log', 'console.info', 'console.debug'] : [],
          passes: 2 // Дополнительные проходы для лучшего сжатия
        },
        mangle: {
          safari10: true // Совместимость с мобильными браузерами
        }
      },
      
      // CSS минификация
      cssMinify: 'esbuild',
      
      // Мониторинг размера бандла
      reportCompressedSize: true,
      
      // Лимит предупреждения для мобильных
      chunkSizeWarningLimit: 300,
      
      // Source maps для debugging
      sourcemap: isDev,
      
      // Оптимизация размера для мобильных
      target: 'es2020',
      cssCodeSplit: true,
      
      // Inline ассеты меньше 4KB для уменьшения HTTP запросов
      assetsInlineLimit: 4096
    },
    
    // CSS настройки
    css: {
      devSourcemap: isDev
    },
    
    // Настройки ассетов
    assetsInclude: ['**/*.gif', '**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.svg'],
    
    // Optimizations
    optimizeDeps: {
      include: [
        // Предварительная оптимизация зависимостей
      ],
      exclude: [
        // Исключения если нужны
      ]
    },
    
    // Plugin configuration (если понадобятся)
    plugins: [
      // Здесь можно добавить плагины по необходимости
    ],
    
    // Resolve настройки
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@js': resolve(__dirname, 'src/js'),
        '@css': resolve(__dirname, 'src/css'),
        '@modules': resolve(__dirname, 'src/modules')
      }
    }
  }
})