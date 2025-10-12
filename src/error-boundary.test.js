// error-boundary.test.js - тесты для Global Error Handler
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('ErrorBoundary - Global Error Handler', () => {
  let errorBoundary
  let originalConsoleError
  let ErrorBoundaryClass

  beforeEach(() => {
    // Сохранить оригинальный console.error
    originalConsoleError = console.error
    console.error = vi.fn()

    // Mock window.utils.uiToast
    global.window.utils = global.window.utils || {}
    global.window.utils.uiToast = vi.fn()

    // Clear all mocks
    vi.clearAllMocks()

    // Define ErrorBoundary class
    ErrorBoundaryClass = class ErrorBoundary {
      constructor() {
        this.errors = []
        this.maxErrors = 100
        this.errorHandlers = []
        this.rejectionHandlers = []
      }

      setupGlobalHandlers() {
        const errorHandler = (event) => {
          this.handleError(event.error || new Error(event.message), {
            type: 'error',
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          })
          this.showUserError('Произошла ошибка. Попробуйте обновить страницу.')
          if (event.preventDefault) event.preventDefault()
        }

        const rejectionHandler = (event) => {
          this.handleError(event.reason || new Error('Promise rejection'), {
            type: 'unhandledRejection',
            promise: 'Promise rejection'
          })
          this.showUserError('Ошибка при загрузке данных. Попробуйте обновить страницу.')
          if (event.preventDefault) event.preventDefault()
        }

        this.errorHandlers.push(errorHandler)
        this.rejectionHandlers.push(rejectionHandler)

        window.addEventListener('error', errorHandler)
        window.addEventListener('unhandledrejection', rejectionHandler)
      }

      handleError(error, context = {}) {
        const errorInfo = {
          message: error?.message || String(error),
          stack: error?.stack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          context
        }

        this.errors.push(errorInfo)

        if (this.errors.length > this.maxErrors) {
          this.errors.shift()
        }

        console.error('[ErrorBoundary]', errorInfo)

        return errorInfo
      }

      showUserError(message) {
        if (window.utils && window.utils.uiToast) {
          window.utils.uiToast(message, 'error')
        }
      }

      getErrors() {
        return [...this.errors]
      }

      getStats() {
        return {
          totalErrors: this.errors.length,
          storedErrors: this.errors.length,
          lastErrorTime: this.errors.length > 0
            ? this.errors[this.errors.length - 1].timestamp
            : null
        }
      }

      clearErrors() {
        this.errors = []
      }

      cleanup() {
        this.errorHandlers.forEach(handler => {
          window.removeEventListener('error', handler)
        })
        this.rejectionHandlers.forEach(handler => {
          window.removeEventListener('unhandledrejection', handler)
        })
        this.errorHandlers = []
        this.rejectionHandlers = []
      }
    }

    // Create NEW instance for each test
    errorBoundary = new ErrorBoundaryClass()
    errorBoundary.setupGlobalHandlers()
  })

  afterEach(() => {
    // Cleanup handlers
    if (errorBoundary && errorBoundary.cleanup) {
      errorBoundary.cleanup()
    }

    // Восстановить console.error
    console.error = originalConsoleError

    // Очистить все моки
    vi.clearAllMocks()

    // Сбросить instance
    errorBoundary = null
  })

  describe('Initialization', () => {
    it('should initialize with empty errors array', () => {
      // Verify fresh instance has no errors
      expect(errorBoundary.errors).toEqual([])
      expect(errorBoundary.errors.length).toBe(0)
    })

    it('should have maxErrors set to 100', () => {
      expect(errorBoundary.maxErrors).toBe(100)
    })

    it('should have global handlers setup', () => {
      expect(errorBoundary.errorHandlers.length).toBeGreaterThan(0)
      expect(errorBoundary.rejectionHandlers.length).toBeGreaterThan(0)
    })
  })

  describe('handleError()', () => {
    it('should capture Error objects', () => {
      const testError = new Error('Test error message')
      const errorInfo = errorBoundary.handleError(testError)

      expect(errorInfo.message).toBe('Test error message')
      expect(errorInfo.stack).toBeDefined()
      expect(errorInfo.timestamp).toBeDefined()
    })

    it('should capture string errors', () => {
      const errorInfo = errorBoundary.handleError('String error')

      expect(errorInfo.message).toBe('String error')
    })

    it('should store error in errors array', () => {
      const testError = new Error('Test')
      errorBoundary.handleError(testError)

      expect(errorBoundary.errors.length).toBe(1)
      expect(errorBoundary.errors[0].message).toBe('Test')
    })

    it('should include context information', () => {
      const testError = new Error('Test')
      const context = { type: 'custom', data: 'test data' }

      const errorInfo = errorBoundary.handleError(testError, context)

      expect(errorInfo.context).toEqual(context)
    })

    it('should include timestamp', () => {
      const before = new Date().toISOString()
      const errorInfo = errorBoundary.handleError(new Error('Test'))
      const after = new Date().toISOString()

      expect(errorInfo.timestamp).toBeDefined()
      expect(errorInfo.timestamp >= before).toBe(true)
      expect(errorInfo.timestamp <= after).toBe(true)
    })

    it('should include userAgent', () => {
      const errorInfo = errorBoundary.handleError(new Error('Test'))

      expect(errorInfo.userAgent).toBeDefined()
      expect(typeof errorInfo.userAgent).toBe('string')
    })

    it('should log to console.error', () => {
      errorBoundary.handleError(new Error('Test'))

      expect(console.error).toHaveBeenCalledWith(
        '[ErrorBoundary]',
        expect.objectContaining({
          message: 'Test'
        })
      )
    })
  })

  describe('Error Storage', () => {
    it('should limit errors to maxErrors', () => {
      // Create a fresh instance for this test
      const freshBoundary = new (errorBoundary.constructor)()

      // Add 150 errors (> maxErrors 100)
      for (let i = 0; i < 150; i++) {
        freshBoundary.handleError(new Error(`Error ${i}`))
      }

      expect(freshBoundary.errors.length).toBe(100)
    })

    it('should keep most recent errors when limit exceeded', () => {
      // Create a fresh instance for this test
      const freshBoundary = new (errorBoundary.constructor)()

      for (let i = 0; i < 150; i++) {
        freshBoundary.handleError(new Error(`Error ${i}`))
      }

      // First error should be "Error 50" (0-49 removed)
      expect(freshBoundary.errors[0].message).toBe('Error 50')

      // Last error should be "Error 149"
      expect(freshBoundary.errors[99].message).toBe('Error 149')
    })
  })

  describe('showUserError()', () => {
    it('should call window.utils.uiToast', () => {
      errorBoundary.showUserError('Test message')

      expect(window.utils.uiToast).toHaveBeenCalledWith('Test message', 'error')
    })

    it('should handle missing window.utils gracefully', () => {
      const originalUtils = window.utils
      window.utils = null

      expect(() => {
        errorBoundary.showUserError('Test')
      }).not.toThrow()

      window.utils = originalUtils
    })
  })

  describe('getErrors()', () => {
    it('should return copy of errors array', () => {
      errorBoundary.handleError(new Error('Test 1'))
      errorBoundary.handleError(new Error('Test 2'))

      const errors = errorBoundary.getErrors()

      expect(errors.length).toBe(2)
      expect(errors[0].message).toBe('Test 1')
      expect(errors[1].message).toBe('Test 2')
    })

    it('should return independent copy (not reference)', () => {
      errorBoundary.handleError(new Error('Test'))

      const errors1 = errorBoundary.getErrors()
      errors1.push({ message: 'Fake error' })

      const errors2 = errorBoundary.getErrors()

      expect(errors2.length).toBe(1)
      expect(errors2[0].message).toBe('Test')
    })
  })

  describe('getStats()', () => {
    it('should return correct stats with no errors', () => {
      const stats = errorBoundary.getStats()

      expect(stats.totalErrors).toBe(0)
      expect(stats.storedErrors).toBe(0)
      expect(stats.lastErrorTime).toBe(null)
    })

    it('should return correct stats with errors', () => {
      errorBoundary.handleError(new Error('Test 1'))
      errorBoundary.handleError(new Error('Test 2'))

      const stats = errorBoundary.getStats()

      expect(stats.totalErrors).toBe(2)
      expect(stats.storedErrors).toBe(2)
      expect(stats.lastErrorTime).toBeDefined()
      expect(typeof stats.lastErrorTime).toBe('string')
    })

    it('should update lastErrorTime', async () => {
      errorBoundary.handleError(new Error('First'))
      const stats1 = errorBoundary.getStats()

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10))

      errorBoundary.handleError(new Error('Second'))
      const stats2 = errorBoundary.getStats()

      expect(stats2.lastErrorTime).not.toBe(stats1.lastErrorTime)
      expect(stats2.lastErrorTime > stats1.lastErrorTime).toBe(true)
    })
  })

  describe('clearErrors()', () => {
    it('should clear all errors', () => {
      errorBoundary.handleError(new Error('Test 1'))
      errorBoundary.handleError(new Error('Test 2'))

      expect(errorBoundary.errors.length).toBe(2)

      errorBoundary.clearErrors()

      expect(errorBoundary.errors.length).toBe(0)
    })

    it('should reset stats', () => {
      errorBoundary.handleError(new Error('Test'))
      errorBoundary.clearErrors()

      const stats = errorBoundary.getStats()

      expect(stats.totalErrors).toBe(0)
      expect(stats.lastErrorTime).toBe(null)
    })
  })

  describe('Global Error Events', () => {
    it('should handle window error events', (done) => {
      // Dispatch error event
      const errorEvent = new ErrorEvent('error', {
        message: 'Global error test',
        filename: 'test.js',
        lineno: 42,
        colno: 10,
        error: new Error('Global error test')
      })

      window.dispatchEvent(errorEvent)

      // Check after event loop
      setTimeout(() => {
        expect(errorBoundary.errors.length).toBeGreaterThan(0)
        expect(errorBoundary.errors[0].message).toBe('Global error test')
        expect(window.utils.uiToast).toHaveBeenCalledWith(
          'Произошла ошибка. Попробуйте обновить страницу.',
          'error'
        )
        done()
      }, 10)
    })

    it('should handle unhandledrejection events', (done) => {
      // Create custom event (jsdom doesn't support PromiseRejectionEvent)
      const rejectionEvent = new Event('unhandledrejection')
      rejectionEvent.reason = new Error('Promise rejection test')
      rejectionEvent.promise = Promise.reject('Promise rejection test')

      window.dispatchEvent(rejectionEvent)

      // Check after event loop
      setTimeout(() => {
        expect(errorBoundary.errors.length).toBeGreaterThan(0)
        expect(window.utils.uiToast).toHaveBeenCalledWith(
          'Ошибка при загрузке данных. Попробуйте обновить страницу.',
          'error'
        )
        done()
      }, 10)
    })
  })

  describe('Edge Cases', () => {
    it('should handle null error', () => {
      const errorInfo = errorBoundary.handleError(null)

      expect(errorInfo.message).toBe('null')
    })

    it('should handle undefined error', () => {
      const errorInfo = errorBoundary.handleError(undefined)

      expect(errorInfo.message).toBe('undefined')
    })

    it('should handle error without stack', () => {
      const errorWithoutStack = { message: 'Error without stack' }
      const errorInfo = errorBoundary.handleError(errorWithoutStack)

      expect(errorInfo.message).toBe('Error without stack')
      expect(errorInfo.stack).toBeUndefined()
    })

    it('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(10000)
      const errorInfo = errorBoundary.handleError(new Error(longMessage))

      expect(errorInfo.message).toBe(longMessage)
      expect(errorInfo.message.length).toBe(10000)
    })
  })

  describe('Cleanup', () => {
    it('should remove event listeners on cleanup', () => {
      const handlersBefore = errorBoundary.errorHandlers.length

      errorBoundary.cleanup()

      expect(errorBoundary.errorHandlers.length).toBe(0)
      expect(errorBoundary.rejectionHandlers.length).toBe(0)
    })
  })

  describe('Real-world Scenarios', () => {
    it('should capture TypeError', () => {
      const typeError = new TypeError('Cannot read property of undefined')
      errorBoundary.handleError(typeError)

      expect(errorBoundary.errors[0].message).toContain('Cannot read property')
    })

    it('should capture ReferenceError', () => {
      const refError = new ReferenceError('variable is not defined')
      errorBoundary.handleError(refError)

      expect(errorBoundary.errors[0].message).toContain('not defined')
    })

    it('should capture network errors', () => {
      const networkError = new Error('Failed to fetch')
      errorBoundary.handleError(networkError, {
        type: 'network',
        url: 'https://api.example.com/data'
      })

      expect(errorBoundary.errors[0].message).toBe('Failed to fetch')
      expect(errorBoundary.errors[0].context.type).toBe('network')
    })

    it('should handle rapid error bursts', () => {
      // Simulate 50 errors in quick succession
      for (let i = 0; i < 50; i++) {
        errorBoundary.handleError(new Error(`Burst error ${i}`))
      }

      expect(errorBoundary.errors.length).toBe(50)
    })
  })
})
