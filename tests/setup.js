// Vitest setup file - инициализация тестового окружения
import { vi } from 'vitest'

// Mock Telegram WebApp API для тестов
global.Telegram = {
  WebApp: {
    ready: vi.fn(),
    expand: vi.fn(), 
    close: vi.fn(),
    showAlert: vi.fn(),
    showConfirm: vi.fn(),
    showPopup: vi.fn(),
    isExpanded: true,
    platform: 'unknown',
    version: '6.0',
    MainButton: {
      setText: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      onClick: vi.fn(),
      offClick: vi.fn()
    },
    BackButton: {
      show: vi.fn(),
      hide: vi.fn(),
      onClick: vi.fn(),
      offClick: vi.fn()
    },
    HapticFeedback: {
      impactOccurred: vi.fn(),
      notificationOccurred: vi.fn(),
      selectionChanged: vi.fn()
    },
    initDataUnsafe: {
      user: {
        id: 123456789,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        language_code: 'en'
      }
    }
  }
}

// Mock window.APP_CONFIG для тестов  
global.window = global.window || {}
global.window.APP_CONFIG = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-key',
  ERROR_BOT_TOKEN: 'test-bot-token',
  ERROR_CHAT_ID: 'test-chat-id',
  ERROR_MONITOR_ENABLED: false, // Отключаем мониторинг в тестах
  PAGE_SIZE_MAIN: 10,
  RETRY_OPTIONS: { retries: 2, backoffMs: 400 },
  PTR_CONFIG: { THRESHOLD: 80, BAR_HEIGHT: 60 },
  SEARCH_FIELDS: ['reason', 'text_highlighted', 'industry', 'company_name'],
  STATUSES: { NEW: 'new', FAVORITE: 'favorite', DELETED: 'deleted' },
  CATEGORIES: { MAIN: 'ТОЧНО ТВОЁ', MAYBE: 'МОЖЕТ БЫТЬ' },
  ENVIRONMENT: 'test',
  IS_DEVELOPMENT: false
}

// Mock утилитных функций 
global.window.utils = {
  uiToast: vi.fn(),
  safeAlert: vi.fn(),
  showCustomConfirm: vi.fn(() => Promise.resolve(true)),
  createSupabaseHeaders: vi.fn(() => ({})),
  escapeHtml: vi.fn(str => str)
}

// Mock logger для тестов
global.window.logger = {
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  api: {
    success: vi.fn(),
    error: vi.fn(),
    request: vi.fn(),
    response: vi.fn()
  },
  ui: {
    action: vi.fn(),
    error: vi.fn(),
    render: vi.fn()
  },
  telegram: {
    event: vi.fn(),
    error: vi.fn(),
    haptic: vi.fn()
  }
}

// Mock fetch для API тестов
global.fetch = vi.fn()

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
}
global.localStorage = localStorageMock

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Console warnings для неожиданных вызовов
beforeEach(() => {
  vi.clearAllMocks()
})

// Дополнительные утилиты для тестов
global.testUtils = {
  // Создание мок элемента DOM
  createMockElement: (tagName = 'div', attributes = {}) => {
    const element = document.createElement(tagName)
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value)
    })
    return element
  },
  
  // Симуляция события
  simulateEvent: (element, eventType, eventInit = {}) => {
    const event = new Event(eventType, eventInit)
    element.dispatchEvent(event)
    return event
  },
  
  // Ожидание nextTick
  nextTick: () => new Promise(resolve => setTimeout(resolve, 0))
}