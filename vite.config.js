import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve'
  const isProd = mode === 'production'
  
  return {
    // Base path для GitHub Pages
    base: isProd ? '/oshu_work/' : '/',
    
    // Настройки сервера разработки с warmup
    server: {
      port: 5173,
      host: true, // Позволяет доступ из сети (полезно для тестирования на мобильных)
      open: true,
      // HTTPS для тестирования Telegram Mini App (REQUIRED для production-like testing)
      https: true, // ✅ ENABLED для безопасности и Telegram compatibility
      
      // Advanced: Warmup стратегия для быстрого старта
      warmup: {
        clientFiles: [
          // Предварительно прогреваем критичные файлы
          './src/js/main.js',
          './src/js/settings-main.js', 
          './src/js/favorites-main.js',
          './src/js/utils.min.js',
          './src/js/constants.js',
          './src/css/style.css',
          './src/css/retro-settings.css'
        ]
      }
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
          // Продвинутое разделение чанков для оптимального кэширования
          manualChunks: (id) => {
            // Простое разделение на vendor и собственный код
            if (id.includes('node_modules')) {
              return 'vendor'
            }
            // Группировка собственных утилит 
            if (id.includes('src/js/utils') || id.includes('src/js/constants')) {
              return 'utils'
            }
            return null
          },
          
          // Оптимизированные имена файлов для кэширования
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId ? 
              chunkInfo.facadeModuleId.split('/').pop().replace(/\.[^/.]+$/, '') : 'chunk';
            return isProd ? `js/${facadeModuleId}-[hash:8].js` : `js/${facadeModuleId}-[hash:8].js`;
          },
          assetFileNames: isProd ? 'assets/[hash:8].[ext]' : 'assets/[name]-[hash:8].[ext]',
          entryFileNames: isProd ? 'js/[name]-[hash:8].js' : 'js/[name]-[hash:8].js',
          
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
          drop_console: isProd ? ['log', 'info', 'debug'] : false, // Оставляем error, warn
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
      
      // JSON оптимизация
      json: {
        stringify: true // Быстрее парсинг JSON файлов
      }
    },
    
    // CSS настройки
    css: {
      devSourcemap: isDev
    },
    
    // Настройки ассетов
    assetsInclude: ['**/*.gif', '**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.svg'],
    
    // Advanced Dependency Optimization
    optimizeDeps: {
      // Принудительная оптимизация часто используемых модулей
      include: [
        // Оптимизация общих утилит
        'src/js/utils.min.js',
        'src/js/constants.js'
      ],
      exclude: [
        // Исключаем уже оптимизированные модули
      ],
      // Новая экспериментальная стратегия для больших проектов
      holdUntilCrawlEnd: false, // Ускоряет cold start
      // Принудительная перезагрузка оптимизации
      force: false,
      // Отключаем автообнаружение для контроля
      noDiscovery: false,
      // ESbuild настройки для оптимизации
      esbuildOptions: {
        target: 'es2015',
        keepNames: false,
        minify: isProd
      }
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