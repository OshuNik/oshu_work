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
    
    // EXTREME Performance конфигурация для Telegram Mini App
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      
      // Multi-page configuration - правильные входные точки
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          favorites: resolve(__dirname, 'favorites.html'),  
          settings: resolve(__dirname, 'settings.html')
        },
        
        // Экстремальная оптимизация для Telegram Mini App
        output: {
          // Ultra-compact filenames для кэширования
          chunkFileNames: isProd ? 'js/[hash:8].js' : 'js/[name]-[hash:8].js',
          assetFileNames: isProd ? 'assets/[hash:8].[ext]' : 'assets/[name]-[hash:8].[ext]',
          entryFileNames: isProd ? 'js/[hash:8].js' : 'js/[name]-[hash:8].js',
          
          // Упрощенное разделение чанков - пусть Vite сам оптимизирует
          
          // Экстремальная оптимизация размера
          compact: true,
          
          // Минимальные import statements
          hoistTransitiveImports: false
        },
        
        // Внешние зависимости (если есть CDN версии)
        external: isProd ? [] : [],
        
        // Умный tree-shaking (не агрессивный)
        treeshake: {
          moduleSideEffects: true, // Сохраняем side effects
          propertyReadSideEffects: true,
          unknownGlobalSideEffects: true
        }
      },
      
      // Минификация для продакшна (менее агрессивная)
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false, // Оставляем консоль для отладки Phase 3.2
          drop_debugger: isProd
        },
        mangle: {
          safari10: true
        }
      },
      
      // Максимальная CSS оптимизация
      cssMinify: 'esbuild',
      
      // Отчетность
      reportCompressedSize: true,
      
      // Mobile-first размеры
      chunkSizeWarningLimit: 200, // Еще строже для Telegram
      
      // Source maps только для dev
      sourcemap: isDev ? 'inline' : false,
      
      // Target для современных мобильных браузеров
      target: ['es2015', 'chrome64', 'firefox67', 'safari12'],
      
      // CSS оптимизации
      cssCodeSplit: true,
      
      // Inline small assets для уменьшения запросов
      assetsInlineLimit: 2048, // Уменьшили для mobile
      
      // Оптимизация для мобильных устройств
      modulePreload: {
        polyfill: false // Убираем polyfill для размера
      },
      
      // Experimental optimizations
      experimental: {
        renderBuiltUrl: (filename) => {
          // Custom asset URL handling если нужно
          return filename;
        }
      }
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