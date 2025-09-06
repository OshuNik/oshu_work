/// <reference types="vitest/config" />
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

export default defineConfig(configEnv => mergeConfig(
  viteConfig(configEnv),
  defineConfig({
    test: {
      // Тестовое окружение для DOM тестов
      environment: 'jsdom',
      
      // Глобальные тесты (как Jest)
      globals: true,
      
      // Паттерны для поиска тестов
      include: [
        'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
        'src/modules/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
        'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
      ],
      
      // Исключения
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.config.{js,ts}',
        '**/src/js/settings.js.backup'
      ],
      
      // Настройки отчетности
      reporter: ['verbose', 'html'],
      outputFile: {
        html: './test-results/index.html'
      },
      
      // Coverage настройки
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        reportsDirectory: './test-results/coverage',
        include: [
          'src/**/*.{js,ts}',
          'src/modules/**/*.{js,ts}'
        ],
        exclude: [
          'src/**/*.{test,spec}.{js,ts}',
          'src/**/*.config.{js,ts}',
          'src/js/settings.js.backup',
          'src/js/debug-*.js', // Debug файлы не тестируем
          'src/js/error-*.js', // Error handlers - сложно тестировать
        ],
        // Пороги покрытия для качественного кода
        thresholds: {
          global: {
            branches: 60,
            functions: 70,
            lines: 70,
            statements: 70
          }
        }
      },
      
      // Setup файлы для инициализации тестов
      setupFiles: ['./tests/setup.js'],
      
      // Dependency optimization для тестов
      server: {
        deps: {
          inline: [
            // Инлайнить модули для тестирования
          ]
        }
      },
      
      // Timeout настройки
      testTimeout: 10000,
      hookTimeout: 10000,
      
      // Настройки среды для тестов
      env: {
        NODE_ENV: 'test',
        VITEST: 'true'
      },
      
      // UI для удобной разработки тестов
      ui: true,
      open: false, // Не открывать автоматически
      
      // Watch настройки
      watchExclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/test-results/**'
      ],
      
      // Логирование
      logLevel: 'info',
      
      // Производительность
      pool: 'threads',
      poolOptions: {
        threads: {
          singleThread: false
        }
      },
      
      // Sequence настройки
      sequence: {
        shuffle: false, // Предсказуемый порядок для отладки
        concurrent: true // Параллельные тесты
      }
    }
  })
))