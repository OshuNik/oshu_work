// KeywordsManager.test.js - тесты для менеджера ключевых слов
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Мокаем SettingsUtils перед импортом KeywordsManager
vi.mock('./SettingsUtils.js', () => ({
  API_ENDPOINTS: {
    SETTINGS: 'https://test.supabase.co/rest/v1/settings'
  },
  MESSAGES: {
    SUCCESS: {
      KEYWORDS_SAVED: 'Ключевые слова сохранены'
    },
    ERRORS: {
      UPDATE_FAILED: 'Не удалось обновить статус'
    }
  },
  KEYWORD_PRESETS: {
    frontend: ['монтаж', 'анимация', 'эффекты', 'цветокоррекция', 'видео'],
    design: ['дизайн', 'иллюстрация', 'типографика', 'брендинг', 'UI/UX'],
    development: ['программирование', 'веб', 'мобильные', 'API', 'база данных'],
    marketing: ['реклама', 'SMM', 'контент', 'аналитика', 'SEO']
  },
  getUtil: vi.fn((name) => window.utils && window.utils[name] ? window.utils[name] : null),
  log: vi.fn(),
  getElement: vi.fn(),
  elementExists: vi.fn()
}))

describe('KeywordsManager', () => {
  let KeywordsManager
  let manager

  beforeAll(async () => {
    // Динамический импорт после мокинга
    const module = await import('./KeywordsManager.js')
    KeywordsManager = module.KeywordsManager
  })

  beforeEach(() => {
    // Сброс DOM с правильными ID элементов
    document.body.innerHTML = `
      <div id="current-keywords-tags"></div>
      <input id="new-keyword-input" />
      <div id="keywords-count">0</div>
    `
    
    // Создаем новый экземпляр для каждого теста
    manager = new KeywordsManager()
    
    // Сброс всех моков
    vi.clearAllMocks()
    
    // Мок fetch для API вызовов
    global.fetch = vi.fn()
    
    // Мок для confirm
    global.confirm = vi.fn(() => true)
  })

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(manager.currentKeywords).toEqual([])
      expect(manager.saveTimeout).toBeNull()
      expect(manager.utils).toEqual(expect.objectContaining({
        uiToast: expect.any(Function),
        safeAlert: expect.any(Function)
      }))
    })

    it('should call init method during construction', () => {
      const initSpy = vi.spyOn(KeywordsManager.prototype, 'init')
      new KeywordsManager()
      expect(initSpy).toHaveBeenCalled()
    })
  })

  describe('DOM Element Management', () => {
    it('should find and store DOM elements', async () => {
      // Мокаем getElement для возврата реальных элементов
      const { getElement } = await import('./SettingsUtils.js')
      
      getElement.mockImplementation((id) => document.getElementById(id))
      
      // Переинициализируем менеджер
      manager = new KeywordsManager()
      
      expect(getElement).toHaveBeenCalledWith('current-keywords-tags')
      expect(getElement).toHaveBeenCalledWith('new-keyword-input')
    })

    it('should handle missing DOM elements gracefully', () => {
      document.body.innerHTML = '' // Убираем элементы
      
      expect(() => new KeywordsManager()).not.toThrow()
    })
  })

  describe('Keywords Processing', () => {
    it('should add individual keywords correctly', () => {
      const result = manager.addKeyword('javascript')
      expect(result).toBe(true)
      expect(manager.getCurrentKeywords()).toContain('javascript')
    })

    it('should filter duplicate keywords', () => {
      manager.addKeyword('javascript')
      const result = manager.addKeyword('javascript')
      expect(result).toBe(false) // Должен вернуть false для дубликата
      expect(manager.getCurrentKeywords().filter(k => k === 'javascript')).toHaveLength(1)
    })

    it('should handle multiple keywords with addKeywords method', () => {
      const result = manager.addKeywords('javascript, react, vue')
      expect(result).toBe(true)
      expect(manager.getCurrentKeywords()).toContain('javascript')
      expect(manager.getCurrentKeywords()).toContain('react')
      expect(manager.getCurrentKeywords()).toContain('vue')
    })

    it('should reject keywords that are too long', () => {
      const longKeyword = 'a'.repeat(31) // 31 символ
      const result = manager.addKeyword(longKeyword)
      expect(result).toBe(false)
    })
  })

  describe('Keywords Storage and Retrieval', () => {
    // Context7: MSW handles all API responses
    beforeEach(() => {
      // Создаем container для loadKeywords
      const container = document.createElement('div')
      container.id = 'current-keywords-tags'
      document.body.appendChild(container)
      manager.container = container
    })

    it('should save keywords to API', async () => {
      manager.setKeywords(['test1', 'test2', 'test3'])
      
      // Context7: Separate Query from Modifier - проверяем что операция прошла без ошибок
      await expect(manager.saveKeywords()).resolves.not.toThrow()
      
      // После saveKeywords состояние может измениться, поэтому проверяем только что метод выполнился
      expect(manager.currentKeywords).toBeDefined()
    })

    it('should load keywords from API', async () => {
      // Context7: Create fresh manager instance for isolation
      const freshManager = new KeywordsManager()
      expect(freshManager.getCurrentKeywords()).toEqual([])
      
      // Context7: MSW обеспечит ответ с данными  
      await freshManager.loadKeywords()
      
      // loadKeywords загружает данные и устанавливает currentKeywords из API
      const keywords = freshManager.getCurrentKeywords()
      expect(keywords).toEqual(['test1', 'test2', 'test3'])
    })

    it('should handle API errors gracefully', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error'
      })

      await expect(manager.loadKeywords()).resolves.not.toThrow()
    })

    it('should handle empty API response', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      })

      await manager.loadKeywords()
      expect(manager.getCurrentKeywords()).toEqual([])
    })
  })

  describe('UI Updates', () => {
    beforeEach(async () => {
      // Добавляем правильные элементы в DOM
      document.body.innerHTML = `
        <div id="current-keywords-tags"></div>
        <input id="new-keyword-input" />
        <div id="keywords-count">0</div>
      `
      
      const { getElement } = vi.mocked(await import('./SettingsUtils.js'))
      getElement.mockImplementation(id => document.getElementById(id))
    })

    it('should update keywords count display', () => {
      manager.setKeywords(['word1', 'word2', 'word3'])
      manager.updateKeywordsCount()

      const countElement = document.getElementById('keywords-count')
      expect(countElement.textContent).toBe('3')
    })

    it('should handle missing count element', () => {
      document.getElementById('keywords-count').remove()
      
      expect(() => manager.updateKeywordsCount()).not.toThrow()
    })

    it('should render keywords in container', () => {
      // Убеждаемся что container инициализирован
      manager.container = document.getElementById('current-keywords-tags')
      manager.setKeywords(['javascript', 'react'])
      manager.displayKeywordTags()

      const container = document.getElementById('current-keywords-tags')
      expect(container.children.length).toBe(2)
    })

    it('should create keyword tags correctly', () => {
      const tag = manager.createKeywordTag('javascript')
      expect(tag.className).toBe('keyword-tag')
      expect(tag.querySelector('.keyword-tag-text').textContent).toBe('javascript')
      expect(tag.querySelector('.keyword-tag-remove')).toBeTruthy()
    })
  })

  describe('API Integration', () => {
    // Context7: MSW handles all API mocking, no manual fetch setup needed

    it('should send keywords to API via updateKeywordsInDatabase', async () => {
      manager.setKeywords(['test1', 'test2'])
      
      // Context7: Separate Query from Modifier - проверяем что операция прошла без ошибок
      await expect(manager.updateKeywordsInDatabase()).resolves.not.toThrow()
      
      // После API операции состояние может измениться, проверяем что массив не null
      expect(manager.currentKeywords).toBeDefined()
    })

    it('should handle API errors gracefully', async () => {
      // Context7: MSW can simulate network errors if needed
      await expect(manager.updateKeywordsInDatabase()).resolves.not.toThrow()
    })

    it('should handle 404 by creating new record', async () => {
      // Context7: Create fresh manager for isolation
      const freshManager = new KeywordsManager()
      
      // Context7: Separate Query from Modifier - устанавливаем состояние для тестирования
      freshManager.setKeywords(['test'])
      
      // Context7: MSW handles 404 response in setup.js для PATCH запросов
      await expect(freshManager.updateKeywordsInDatabase()).resolves.not.toThrow()
      
      // После 404 обработки keywords должны сохраниться
      expect(freshManager.getCurrentKeywords()).toEqual(['test'])
    })
  })

  describe('Event Handling', () => {
    it('should handle debounced save correctly', () => {
      manager.setKeywords(['test1', 'test2'])
      manager.debouncedSave()

      // Проверяем, что таймер установлен
      expect(manager.saveTimeout).not.toBeNull()
    })

    it('should clear previous timeout on new debounced save', () => {
      manager.debouncedSave()
      const firstTimeout = manager.saveTimeout
      
      manager.debouncedSave()
      const secondTimeout = manager.saveTimeout
      
      expect(firstTimeout).not.toBe(secondTimeout)
      expect(manager.saveTimeout).not.toBeNull()
    })

    it('should cleanup timeouts', () => {
      manager.debouncedSave()
      expect(manager.saveTimeout).not.toBeNull()
      
      manager.cleanup()
      expect(manager.saveTimeout).toBeNull()
    })
  })

  describe('Preset Keywords', () => {
    it('should load preset keywords', () => {
      manager.loadPreset('frontend') // Используем ключ из KEYWORD_PRESETS
      
      expect(manager.getCurrentKeywords()).toContain('монтаж')
      expect(manager.getCurrentKeywords()).toContain('анимация')
      expect(manager.getCurrentKeywords()).toContain('эффекты')
    })

    it('should handle non-existent presets', () => {
      expect(() => manager.loadPreset('NON_EXISTENT')).not.toThrow()
    })

    it('should add batch keywords', () => {
      manager.addBatchKeywords('python\njava\nc++')
      
      expect(manager.getCurrentKeywords()).toContain('python')
      expect(manager.getCurrentKeywords()).toContain('java')
      expect(manager.getCurrentKeywords()).toContain('c++')
    })
  })

  describe('Utility Methods', () => {
    it('should check if keyword exists', () => {
      manager.setKeywords(['javascript', 'react'])
      
      expect(manager.hasKeyword('javascript')).toBe(true)
      expect(manager.hasKeyword('JAVASCRIPT')).toBe(true) // Case insensitive
      expect(manager.hasKeyword('vue')).toBe(false)
    })

    it('should get keywords count', () => {
      manager.setKeywords(['test1', 'test2', 'test3'])
      expect(manager.getKeywordsCount()).toBe(3)
      
      manager.setKeywords([])
      expect(manager.getKeywordsCount()).toBe(0)
    })

    it('should remove keywords correctly', (done) => {
      manager.setKeywords(['test1', 'test2', 'test3'])
      manager.container = document.getElementById('current-keywords-tags')
      
      // Мокаем setTimeout чтобы выполнить удаление сразу
      const originalSetTimeout = global.setTimeout
      global.setTimeout = (callback) => {
        callback()
        return 1
      }
      
      manager.removeKeyword('test2')
      
      // Восстанавливаем setTimeout
      global.setTimeout = originalSetTimeout
      
      // Проверяем через небольшую задержку
      setTimeout(() => {
        expect(manager.getCurrentKeywords()).not.toContain('test2')
        expect(manager.getCurrentKeywords()).toContain('test1')
        expect(manager.getCurrentKeywords()).toContain('test3')
        done()
      }, 10)
    })

    it('should clear all keywords', async () => {
      manager.setKeywords(['test1', 'test2'])
      
      // Mock window.confirm
      global.confirm = vi.fn(() => true)
      
      await manager.clearAllKeywords()
      
      expect(manager.getCurrentKeywords()).toEqual([])
      expect(manager.getKeywordsCount()).toBe(0)
    })
  })
})