// basic.test.js - базовые тесты для проверки testing infrastructure
import { describe, it, expect, vi } from 'vitest'

describe('Testing Infrastructure', () => {
  describe('Setup & Environment', () => {
    it('should have global test utilities available', () => {
      expect(global.testUtils).toBeDefined()
      expect(global.testUtils.createMockElement).toBeTypeOf('function')
      expect(global.testUtils.simulateEvent).toBeTypeOf('function')
      expect(global.testUtils.nextTick).toBeTypeOf('function')
    })

    it('should have mocked Telegram WebApp API', () => {
      expect(global.Telegram).toBeDefined()
      expect(global.Telegram.WebApp).toBeDefined()
      expect(global.Telegram.WebApp.ready).toBeTypeOf('function')
      expect(global.Telegram.WebApp.expand).toBeTypeOf('function')
    })

    it('should have mocked APP_CONFIG', () => {
      expect(window.APP_CONFIG).toBeDefined()
      expect(window.APP_CONFIG.SUPABASE_URL).toBe('https://test.supabase.co')
      expect(window.APP_CONFIG.ENVIRONMENT).toBe('test')
      expect(window.APP_CONFIG.ERROR_MONITOR_ENABLED).toBe(false)
    })

    it('should have mocked utilities', () => {
      expect(window.utils).toBeDefined()
      expect(window.utils.uiToast).toBeTypeOf('function')
      expect(window.utils.safeAlert).toBeTypeOf('function')
    })

    it('should have mocked logger', () => {
      expect(window.logger).toBeDefined()
      expect(window.logger.log).toBeTypeOf('function')
      expect(window.logger.error).toBeTypeOf('function')
      expect(window.logger.api.success).toBeTypeOf('function')
    })

    it('should have mocked localStorage', () => {
      expect(localStorage.getItem).toBeTypeOf('function')
      expect(localStorage.setItem).toBeTypeOf('function')
      expect(localStorage.removeItem).toBeTypeOf('function')
    })
  })

  describe('Vitest Functionality', () => {
    it('should support basic assertions', () => {
      expect(1 + 1).toBe(2)
      expect('hello').toContain('ell')
      expect([1, 2, 3]).toHaveLength(3)
    })

    it('should support async/await', async () => {
      const result = await Promise.resolve('async works')
      expect(result).toBe('async works')
    })

    it('should support mocking with vi', () => {
      const mockFn = vi.fn()
      mockFn('test')
      
      expect(mockFn).toHaveBeenCalledWith('test')
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should support DOM testing', () => {
      const element = testUtils.createMockElement('div', { id: 'test' })
      expect(element.tagName).toBe('DIV')
      expect(element.id).toBe('test')
    })

    it('should support event simulation', () => {
      const element = testUtils.createMockElement('button')
      const handler = vi.fn()
      
      element.addEventListener('click', handler)
      testUtils.simulateEvent(element, 'click')
      
      expect(handler).toHaveBeenCalled()
    })
  })

  describe('Mock Clearing', () => {
    it('should clear mocks between tests', () => {
      // Все моки должны быть очищены
      expect(window.utils.uiToast).not.toHaveBeenCalled()
      expect(window.logger.log).not.toHaveBeenCalled()
      expect(localStorage.getItem).not.toHaveBeenCalled()
    })
  })

  describe('Test Utilities', () => {
    it('should create DOM elements correctly', () => {
      const button = testUtils.createMockElement('button', {
        type: 'submit',
        class: 'btn btn-primary',
        'data-testid': 'submit-btn'
      })

      expect(button.type).toBe('submit')
      expect(button.className).toBe('btn btn-primary')
      expect(button.getAttribute('data-testid')).toBe('submit-btn')
    })

    it('should simulate events with custom data', () => {
      const input = testUtils.createMockElement('input')
      const handler = vi.fn()
      
      input.addEventListener('change', handler)
      
      const event = testUtils.simulateEvent(input, 'change', {
        bubbles: true,
        cancelable: true
      })
      
      expect(handler).toHaveBeenCalled()
      expect(event.bubbles).toBe(true)
      expect(event.cancelable).toBe(true)
    })

    it('should support nextTick utility', async () => {
      let asyncValue = 'initial'
      
      // Симулируем асинхронное изменение
      setTimeout(() => {
        asyncValue = 'changed'
      }, 0)
      
      // Ждем nextTick
      await testUtils.nextTick()
      
      expect(asyncValue).toBe('changed')
    })
  })

  describe('Error Handling', () => {
    it('should handle thrown errors in tests', () => {
      expect(() => {
        throw new Error('Test error')
      }).toThrow('Test error')
    })

    it('should handle rejected promises', async () => {
      const rejectingPromise = Promise.reject(new Error('Async error'))
      
      await expect(rejectingPromise).rejects.toThrow('Async error')
    })
  })
})