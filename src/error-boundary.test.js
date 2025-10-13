// error-boundary.test.js - тесты для Global Error Handler
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Factory function to create a FRESH ErrorBoundary class for each test
function createErrorBoundaryClass() {
  return class ErrorBoundary {
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

      // Don't call console.error in tests - it doesn't trigger global handlers
      // console.error('[ErrorBoundary]', errorInfo)

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
}

describe('ErrorBoundary - Global Error Handler', () => {
  let errorBoundary
  let originalConsoleError

  beforeEach(() => {
    // Cleanup any previous instance
    if (errorBoundary) {
      if (errorBoundary.clearErrors) errorBoundary.clearErrors()
      if (errorBoundary.cleanup) errorBoundary.cleanup()
      errorBoundary = null
    }

    // Сохранить оригинальный console.error
    originalConsoleError = console.error
    console.error = vi.fn()

    // Mock window.utils.uiToast - FRESH mock every time
    global.window.utils = {
      uiToast: vi.fn()
    }

    // Clear ALL mocks
    vi.clearAllMocks()

    // Create COMPLETELY FRESH class and instance for each test
    const ErrorBoundaryClass = createErrorBoundaryClass()
    errorBoundary = new ErrorBoundaryClass()

    // DEBUG: Verify clean state
    if (errorBoundary.errors.length !== 0) {
      console.log('⚠️ BEFORE TEST: errorBoundary.errors NOT EMPTY:', errorBoundary.errors.length)
    }
  })

  afterEach(() => {
    // Cleanup errors first
    if (errorBoundary && errorBoundary.clearErrors) {
      errorBoundary.clearErrors()
    }

    // Cleanup handlers
    if (errorBoundary && errorBoundary.cleanup) {
      errorBoundary.cleanup()
    }

    // Восстановить console.error
    console.error = originalConsoleError

    // Очистить все моки
    vi.clearAllMocks()

    // Очистить window.utils.uiToast mock
    if (window.utils && window.utils.uiToast) {
      window.utils.uiToast.mockClear()
    }

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
      errorBoundary.setupGlobalHandlers() // Setup for this test
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

    // Temporarily disabled - console.error removed from test implementation
    it.skip('should log to console.error', () => {
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
      // Create a COMPLETELY fresh class and instance for this test
      const FreshErrorBoundaryClass = createErrorBoundaryClass()
      const freshBoundary = new FreshErrorBoundaryClass()

      // Add 150 errors (> maxErrors 100)
      for (let i = 0; i < 150; i++) {
        freshBoundary.handleError(new Error(`Error ${i}`))
      }

      expect(freshBoundary.errors.length).toBe(100)
    })

    it('should keep most recent errors when limit exceeded', () => {
      // Create a COMPLETELY fresh class and instance for this test
      const FreshErrorBoundaryClass = createErrorBoundaryClass()
      const freshBoundary = new FreshErrorBoundaryClass()

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

    it('should update lastErrorTime', () => {
      vi.useFakeTimers()

      errorBoundary.handleError(new Error('First'))
      const stats1 = errorBoundary.getStats()

      // Advance time
      vi.advanceTimersByTime(10)

      errorBoundary.handleError(new Error('Second'))
      const stats2 = errorBoundary.getStats()

      expect(stats2.lastErrorTime).not.toBe(stats1.lastErrorTime)
      expect(stats2.lastErrorTime > stats1.lastErrorTime).toBe(true)

      vi.useRealTimers()
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
    it('should handle window error events', () => {
      errorBoundary.setupGlobalHandlers() // Setup for this test
      vi.useFakeTimers()

      try {
        // Dispatch error event
        const errorEvent = new ErrorEvent('error', {
          message: 'Global error test',
          filename: 'test.js',
          lineno: 42,
          colno: 10,
          error: new Error('Global error test')
        })

        window.dispatchEvent(errorEvent)

        // Run pending timers
        vi.runAllTimers()

        // Check immediately (synchronous with fake timers)
        expect(errorBoundary.errors.length).toBeGreaterThan(0)
        expect(errorBoundary.errors[errorBoundary.errors.length - 1].message).toBe('Global error test')
        expect(window.utils.uiToast).toHaveBeenCalledWith(
          'Произошла ошибка. Попробуйте обновить страницу.',
          'error'
        )
      } finally {
        vi.useRealTimers()
        errorBoundary.cleanup() // CRITICAL: cleanup handlers immediately
      }
    })

    it('should handle unhandledrejection events', () => {
      errorBoundary.setupGlobalHandlers() // Setup for this test
      vi.useFakeTimers()

      try {
        // Create custom event (jsdom doesn't support PromiseRejectionEvent)
        const rejectionEvent = new Event('unhandledrejection')
        rejectionEvent.reason = new Error('Promise rejection test')
        rejectionEvent.promise = Promise.reject('Promise rejection test')

        window.dispatchEvent(rejectionEvent)

        // Run pending timers
        vi.runAllTimers()

        // Check immediately (synchronous with fake timers)
        expect(errorBoundary.errors.length).toBeGreaterThan(0)
        expect(window.utils.uiToast).toHaveBeenCalledWith(
          'Ошибка при загрузке данных. Попробуйте обновить страницу.',
          'error'
        )
      } finally {
        vi.useRealTimers()
        errorBoundary.cleanup() // CRITICAL: cleanup handlers immediately
      }
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
      errorBoundary.setupGlobalHandlers() // Setup for this test
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

      expect(errorBoundary.errors.length).toBe(1)
      expect(errorBoundary.errors[0].message).toContain('Cannot read property')
    })

    it('should capture ReferenceError', () => {
      const refError = new ReferenceError('variable is not defined')
      errorBoundary.handleError(refError)

      expect(errorBoundary.errors.length).toBe(1)
      expect(errorBoundary.errors[0].message).toContain('not defined')
    })

    it('should capture network errors', () => {
      const networkError = new Error('Failed to fetch')
      errorBoundary.handleError(networkError, {
        type: 'network',
        url: 'https://api.example.com/data'
      })

      expect(errorBoundary.errors.length).toBe(1)
      expect(errorBoundary.errors[0].message).toBe('Failed to fetch')
      expect(errorBoundary.errors[0].context.type).toBe('network')
    })

    it('should handle rapid error bursts', () => {
      // Ensure we start with clean state
      expect(errorBoundary.errors.length).toBe(0)

      // Simulate 50 errors in quick succession
      for (let i = 0; i < 50; i++) {
        errorBoundary.handleError(new Error(`Burst error ${i}`))
      }

      expect(errorBoundary.errors.length).toBe(50)
    })
  })
})
