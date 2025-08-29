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
      
      // Multi-page configuration
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
          
          // Smart chunking для Telegram performance
          manualChunks: {
            // Critical path - только необходимое для первого экрана
            'critical': [
              './src/js/config.js',
              './src/js/constants.js',
              './src/js/csp-manager.js'
            ],
            
            // Telegram-specific utilities
            'telegram-utils': [
              './src/js/telegram-integration.js',
              './src/js/smart-cache.js'
            ],
            
            // Core job functionality
            'job-core': [
              './src/js/vacancy-manager.js',
              './src/js/state-manager.js'
            ],
            
            // UI libraries - загружаются по требованию
            'ui-libs': [
              './src/js/dom-manager.js',
              './src/js/template-loader.js',
              './src/js/swipe-handler.js'
            ],
            
            // Network & API - defer loading
            'network': [
              './src/js/api-service.js',
              './src/js/network-manager.js'
            ]
          },
          
          // Экстремальная оптимизация размера
          compact: true,
          
          // Минимальные import statements
          hoistTransitiveImports: false
        },
        
        // Внешние зависимости (если есть CDN версии)
        external: isProd ? [] : [],
        
        // Tree-shaking конфигурация
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          unknownGlobalSideEffects: false
        }
      },
      
      // Экстремальная минификация для Telegram
      minify: 'terser',
      terserOptions: {
        compress: {
          // Агрессивное удаление кода
          drop_console: isProd,
          drop_debugger: isProd,
          pure_funcs: isProd ? ['console.log', 'console.info', 'console.debug', 'console.warn'] : [],
          
          // Экстремальные optimizations
          passes: 3, // Больше проходов для лучшего сжатия
          unsafe_arrows: true,
          unsafe_methods: true,
          unsafe_proto: true,
          
          // Mobile-specific optimizations
          collapse_vars: true,
          reduce_vars: true,
          hoist_funs: true,
          hoist_props: true,
          hoist_vars: false, // Лучше для mobile memory
          
          // Remove unused
          dead_code: true,
          unused: true
        },
        mangle: {
          safari10: true,
          toplevel: true, // Mangle top-level names
          properties: false // Не manglе properties для стабильности
        },
        format: {
          comments: false, // Убираем все комментарии
          ecma: 2020
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