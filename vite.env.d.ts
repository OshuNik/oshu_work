/// <reference types="vite/client" />

// Типизация переменных окружения для TypeScript (опционально)
interface ImportMetaEnv {
  readonly VITE_APP_ENV: string
  readonly VITE_APP_VERSION: string
  readonly VITE_APP_DEBUG: string
  readonly VITE_TELEGRAM_BOT_NAME: string
  readonly VITE_BASE_URL: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_ENABLE_MOCK_API: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}