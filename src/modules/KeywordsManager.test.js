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
    FRONTEND: ['javascript', 'react', 'vue'],
    BACKEND: ['node', 'python', 'java']
  },
  getUtil: () => window.utils,
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
    // Сброс DOM
    document.body.innerHTML = `
      <div id="keywords-container"></div>
      <input id="keywords-input" />
      <div id="keywords-count">0</div>
    `
    
    // Создаем новый экземпляр для каждого теста
    manager = new KeywordsManager()
    
    // Сброс всех моков
    vi.clearAllMocks()
    
    // Мок fetch для API вызовов
    global.fetch = vi.fn()
  })

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(manager.currentKeywords).toEqual([])
      expect(manager.saveTimeout).toBeNull()
      expect(manager.utils).toBe(window.utils)
    })

    it('should call init method during construction', () => {
      const initSpy = vi.spyOn(KeywordsManager.prototype, 'init')
      new KeywordsManager()
      expect(initSpy).toHaveBeenCalled()
    })
  })

  describe('DOM Element Management', () => {
    it('should find and store DOM elements', () => {
      // Мокаем getElement для возврата реальных элементов
      const { getElement } = await import('./SettingsUtils.js')
      
      getElement.mockImplementation((id) => document.getElementById(id))
      
      // Переинициализируем менеджер
      manager = new KeywordsManager()
      
      expect(getElement).toHaveBeenCalledWith('keywords-container')
      expect(getElement).toHaveBeenCalledWith('keywords-input')
    })

    it('should handle missing DOM elements gracefully', () => {
      document.body.innerHTML = '' // Убираем элементы
      
      expect(() => new KeywordsManager()).not.toThrow()
    })
  })

  describe('Keywords Processing', () => {
    it('should parse keywords from text correctly', () => {
      const testCases = [
        { input: 'javascript, react, vue', expected: ['javascript', 'react', 'vue'] },
        { input: 'word1;word2;word3', expected: ['word1', 'word2', 'word3'] },
        { input: 'word1 word2 word3', expected: ['word1', 'word2', 'word3'] },
        { input: '  spaced  ,  words  ', expected: ['spaced', 'words'] },
        { input: 'duplicate,duplicate,unique', expected: ['duplicate', 'unique'] }
      ]

      testCases.forEach(({ input, expected }) => {
        const result = manager.parseKeywords(input)
        expect(result).toEqual(expected)
      })
    })

    it('should filter empty and invalid keywords', () => {
      const input = 'valid, , empty, , another'
      const result = manager.parseKeywords(input)
      expect(result).toEqual(['valid', 'empty', 'another'])
    })

    it('should handle special characters in keywords', () => {
      const input = 'c++, c#, .net, @angular'
      const result = manager.parseKeywords(input)
      expect(result).toContain('c++')
      expect(result).toContain('c#')
      expect(result).toContain('.net')
      expect(result).toContain('@angular')
    })
  })

  describe('Keywords Storage and Retrieval', () => {
    beforeEach(() => {
      // Мок localStorage
      global.localStorage.getItem.mockReturnValue(null)
      global.localStorage.setItem.mockClear()
    })

    it('should save keywords to localStorage', () => {
      const keywords = ['test1', 'test2', 'test3']
      manager.saveKeywords(keywords)

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'settings-keywords',
        JSON.stringify(keywords)
      )
    })

    it('should load keywords from localStorage', () => {
      const storedKeywords = ['stored1', 'stored2']
      localStorage.getItem.mockReturnValue(JSON.stringify(storedKeywords))

      const result = manager.loadKeywords()
      expect(result).toEqual(storedKeywords)
    })

    it('should handle corrupted localStorage data', () => {
      localStorage.getItem.mockReturnValue('invalid json')

      const result = manager.loadKeywords()
      expect(result).toEqual([])
    })

    it('should handle missing localStorage data', () => {
      localStorage.getItem.mockReturnValue(null)

      const result = manager.loadKeywords()
      expect(result).toEqual([])
    })
  })

  describe('UI Updates', () => {
    beforeEach(async () => {
      const { getElement } = vi.mocked(await import('./SettingsUtils.js'))
      getElement.mockImplementation(id => document.getElementById(id))
    })

    it('should update keywords count display', () => {
      manager.currentKeywords = ['word1', 'word2', 'word3']
      manager.updateKeywordsCount()

      const countElement = document.getElementById('keywords-count')
      expect(countElement.textContent).toBe('3')
    })

    it('should handle missing count element', () => {
      document.getElementById('keywords-count').remove()
      
      expect(() => manager.updateKeywordsCount()).not.toThrow()
    })

    it('should render keywords in container', () => {
      manager.currentKeywords = ['javascript', 'react']
      manager.renderKeywords()

      const container = document.getElementById('keywords-container')
      expect(container.children.length).toBe(2)
    })
  })

  describe('API Integration', () => {
    beforeEach(() => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })
    })

    it('should send keywords to API', async () => {
      const keywords = ['test1', 'test2']
      await manager.syncWithAPI(keywords)

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('supabase.co'),
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.any(Object),
          body: expect.stringContaining('test1')
        })
      )
    })

    it('should handle API errors gracefully', async () => {
      fetch.mockRejectedValue(new Error('Network error'))

      await expect(manager.syncWithAPI(['test'])).resolves.not.toThrow()
    })

    it('should handle non-ok API responses', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      await expect(manager.syncWithAPI(['test'])).resolves.not.toThrow()
    })
  })

  describe('Event Handling', () => {
    it('should handle input changes with debouncing', (done) => {
      const input = document.getElementById('keywords-input')
      input.value = 'test, keywords'

      // Симулируем событие input
      const event = new Event('input')
      input.dispatchEvent(event)

      // Проверяем, что таймер установлен
      expect(manager.saveTimeout).not.toBeNull()

      // Проверяем, что функция вызовется через некоторое время
      setTimeout(() => {
        expect(manager.currentKeywords).toContain('test')
        expect(manager.currentKeywords).toContain('keywords')
        done()
      }, 1100) // Больше чем задержка debounce
    })
  })

  describe('Preset Keywords', () => {
    it('should apply preset keywords', () => {
      manager.applyPreset('FRONTEND')
      
      expect(manager.currentKeywords).toContain('javascript')
      expect(manager.currentKeywords).toContain('react')
      expect(manager.currentKeywords).toContain('vue')
    })

    it('should handle non-existent presets', () => {
      expect(() => manager.applyPreset('NON_EXISTENT')).not.toThrow()
    })
  })

  describe('Error Scenarios', () => {
    it('should handle network failures during API sync', async () => {
      fetch.mockRejectedValue(new Error('Failed to fetch'))
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      await manager.syncWithAPI(['test'])
      
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should handle malformed keyword input', () => {
      const weirdInput = 'normal, , ,,, valid,    '
      const result = manager.parseKeywords(weirdInput)
      
      expect(result).toEqual(['normal', 'valid'])
    })
  })
})