// SettingsUtils.test.js - тесты для утилит настроек
import { describe, it, expect, vi } from 'vitest'
import { 
  CHANNEL_VALIDATION, 
  API_ENDPOINTS, 
  MESSAGES,
  getUtil,
  getUtils,
  log,
  getElement,
  createElement,
  elementExists,
  addEventListener,
  removeEventListener,
  checkDependencies
} from './SettingsUtils.js'

describe('SettingsUtils', () => {
  describe('Constants', () => {
    it('should have correct CHANNEL_VALIDATION constants', () => {
      expect(CHANNEL_VALIDATION.MIN_LENGTH).toBe(5)
      expect(CHANNEL_VALIDATION.MAX_LENGTH).toBe(32)
      expect(CHANNEL_VALIDATION.PATTERN).toBeInstanceOf(RegExp)
      expect('test123').toMatch(CHANNEL_VALIDATION.PATTERN)
      expect('test@123').not.toMatch(CHANNEL_VALIDATION.PATTERN)
    })

    it('should have API_ENDPOINTS with correct structure', () => {
      expect(API_ENDPOINTS).toHaveProperty('SETTINGS')
      expect(API_ENDPOINTS).toHaveProperty('CHANNELS')
      expect(API_ENDPOINTS).toHaveProperty('DEFAULT_CHANNELS')
      expect(API_ENDPOINTS.SETTINGS).toContain('supabase.co')
    })

    it('should have MESSAGES with errors and success', () => {
      expect(MESSAGES).toHaveProperty('ERRORS')
      expect(MESSAGES).toHaveProperty('SUCCESS')
      expect(MESSAGES.ERRORS).toHaveProperty('CHANNEL_EXISTS')
      expect(MESSAGES.SUCCESS).toHaveProperty('CHANNEL_ADDED')
    })
  })

  describe('Utility Functions', () => {
    beforeEach(() => {
      // Сбрасываем DOM для каждого теста
      document.body.innerHTML = ''
    })

    it('should get utility functions from window.utils', () => {
      const utils = getUtils()
      expect(utils).toBe(window.utils)
      expect(utils).toHaveProperty('uiToast')
      expect(utils).toHaveProperty('safeAlert')
    })

    it('should log messages using console', () => {
      const logSpy = vi.spyOn(console, 'log')
      const errorSpy = vi.spyOn(console, 'error')

      log('log', 'Test message')
      log('error', 'Error message')

      expect(logSpy).toHaveBeenCalledWith('[SettingsUtils] Test message')
      expect(errorSpy).toHaveBeenCalledWith('[SettingsUtils] Error message')
      
      // Восстанавливаем spy
      logSpy.mockRestore()
      errorSpy.mockRestore()
    })

    it('should get DOM element by id', () => {
      const testDiv = document.createElement('div')
      testDiv.id = 'test-element'
      document.body.appendChild(testDiv)

      const element = getElement('test-element')
      expect(element).toBe(testDiv)
      expect(getElement('non-existent')).toBeNull()
    })

    it('should create DOM element with attributes', () => {
      const element = createElement('button', {
        id: 'test-btn',
        class: 'btn btn-primary',
        'data-testid': 'test'
      })

      expect(element.tagName).toBe('BUTTON')
      expect(element.id).toBe('test-btn')
      expect(element.className).toBe('btn btn-primary')
      expect(element.getAttribute('data-testid')).toBe('test')
    })

    it('should check if element exists', () => {
      const testDiv = document.createElement('div')
      testDiv.id = 'existing-element'
      document.body.appendChild(testDiv)

      expect(elementExists('#existing-element')).toBe(true)
      expect(elementExists('#non-existent')).toBe(false)
    })

    it('should add and remove event listeners', () => {
      const testDiv = document.createElement('div')
      testDiv.id = 'test-element'
      document.body.appendChild(testDiv)

      const handler = vi.fn()
      
      // Добавляем слушатель напрямую с DOM элементом
      const success = addEventListener(testDiv, 'click', handler)
      expect(success).toBe(true)

      // Тестируем событие
      testDiv.click()
      expect(handler).toHaveBeenCalledTimes(1)

      // Удаляем слушатель
      const removed = removeEventListener(testDiv, 'click', handler)
      expect(removed).toBe(true)

      // Событие больше не должно вызываться
      testDiv.click()
      expect(handler).toHaveBeenCalledTimes(1) // Все еще 1
    })

    it('should handle non-existent elements gracefully', () => {
      expect(() => addEventListener('non-existent', 'click', vi.fn())).not.toThrow()
      expect(() => removeEventListener('non-existent', 'click', vi.fn())).not.toThrow()
      
      expect(addEventListener('non-existent', 'click', vi.fn())).toBe(false)
      expect(removeEventListener('non-existent', 'click', vi.fn())).toBe(false)
    })

    it('should check dependencies correctly', () => {
      // Положительный случай - все зависимости есть
      expect(checkDependencies()).toBe(true)

      // Негативный случай - отсутствует utils
      const originalUtils = window.utils
      const originalConfig = window.APP_CONFIG
      
      window.utils = null
      expect(checkDependencies()).toBe(false)
      
      // Восстанавливаем utils, тестируем пустой config
      window.utils = originalUtils
      window.APP_CONFIG = {}
      expect(checkDependencies()).toBe(false)
      
      // Восстанавливаем всё
      window.APP_CONFIG = originalConfig
    })
  })

  describe('Error Handling', () => {
    it('should handle missing logger gracefully', () => {
      const originalLogger = window.logger
      delete window.logger

      expect(() => log('log', 'test')).not.toThrow()
      
      window.logger = originalLogger
    })

    it('should handle missing utils gracefully', () => {
      const originalUtils = window.utils
      delete window.utils

      const utils = getUtils()
      expect(utils).toEqual(null) // getUtils возвращает null если window.utils нет (Context7 fix)
      
      window.utils = originalUtils
    })
  })

  describe('DOM Manipulation Edge Cases', () => {
    it('should handle createElement with no attributes', () => {
      const element = createElement('div')
      expect(element.tagName).toBe('DIV')
      expect(element.attributes.length).toBe(0)
    })

    it('should handle createElement with null/undefined attributes', () => {
      const element = createElement('span', {
        title: null,
        'data-value': undefined,
        id: 'test'
      })
      
      expect(element.id).toBe('test')
      expect(element.getAttribute('title')).toBe('null')
      expect(element.getAttribute('data-value')).toBe('undefined')
    })
  })
})