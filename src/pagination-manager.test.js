// pagination-manager.test.js - тесты для Pagination Manager
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('PaginationManager - Infinite Scroll & Pagination', () => {
  let PaginationManager

  beforeEach(() => {
    // Define PaginationManager class
    PaginationManager = class PaginationManager {
      constructor(options = {}) {
        this.pageSize = options.pageSize || 20
        this.currentPage = 0
        this.hasMore = true
        this.loading = false
        this.total = 0
        this.scrollCleanup = null
      }

      reset() {
        this.currentPage = 0
        this.hasMore = true
        this.loading = false
        this.total = 0
      }

      canLoadMore() {
        return this.hasMore && !this.loading
      }

      async loadPage(fetchFunction) {
        if (!this.canLoadMore()) {
          return { data: [], hasMore: false }
        }

        this.loading = true

        try {
          const offset = this.currentPage * this.pageSize

          const result = await fetchFunction({
            limit: this.pageSize,
            offset: offset
          })

          if (result.success && Array.isArray(result.data)) {
            this.currentPage++
            this.total = result.total || 0

            if (result.data.length < this.pageSize) {
              this.hasMore = false
            }

            if (this.total > 0 && (this.currentPage * this.pageSize >= this.total)) {
              this.hasMore = false
            }

            return {
              data: result.data,
              hasMore: this.hasMore,
              total: this.total,
              currentPage: this.currentPage
            }
          }

          this.hasMore = false
          return { data: [], hasMore: false, error: result.error }

        } catch (error) {
          console.error('[Pagination] Error loading page:', error)
          this.hasMore = false
          return { data: [], hasMore: false, error: error.message }
        } finally {
          this.loading = false
        }
      }

      setupInfiniteScroll(options = {}) {
        const {
          container,
          onLoadMore,
          threshold = 300
        } = options

        if (!container || typeof onLoadMore !== 'function') {
          console.warn('[Pagination] Invalid infinite scroll setup')
          return null
        }

        const handleScroll = () => {
          if (this.loading || !this.hasMore) {
            return
          }

          const scrollTop = window.pageYOffset || document.documentElement.scrollTop
          const scrollHeight = document.documentElement.scrollHeight
          const clientHeight = document.documentElement.clientHeight

          const distanceFromBottom = scrollHeight - scrollTop - clientHeight

          if (distanceFromBottom < threshold) {
            onLoadMore()
          }
        }

        let scrollTimeout
        const throttledScroll = () => {
          if (scrollTimeout) return

          scrollTimeout = setTimeout(() => {
            handleScroll()
            scrollTimeout = null
          }, 200)
        }

        window.addEventListener('scroll', throttledScroll, { passive: true })

        this.scrollCleanup = () => {
          window.removeEventListener('scroll', throttledScroll)
          if (scrollTimeout) clearTimeout(scrollTimeout)
        }

        return this.scrollCleanup
      }

      cleanup() {
        if (this.scrollCleanup) {
          this.scrollCleanup()
          this.scrollCleanup = null
        }
      }

      getStats() {
        return {
          currentPage: this.currentPage,
          pageSize: this.pageSize,
          total: this.total,
          hasMore: this.hasMore,
          loading: this.loading,
          loadedItems: this.currentPage * this.pageSize
        }
      }
    }
  })

  afterEach(() => {
    // Clean up any scroll listeners
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      const paginator = new PaginationManager()

      expect(paginator.pageSize).toBe(20)
      expect(paginator.currentPage).toBe(0)
      expect(paginator.hasMore).toBe(true)
      expect(paginator.loading).toBe(false)
      expect(paginator.total).toBe(0)
    })

    it('should initialize with custom pageSize', () => {
      const paginator = new PaginationManager({ pageSize: 50 })

      expect(paginator.pageSize).toBe(50)
    })

    it('should initialize with custom pageSize = 10', () => {
      const paginator = new PaginationManager({ pageSize: 10 })

      expect(paginator.pageSize).toBe(10)
    })
  })

  describe('reset()', () => {
    it('should reset to initial state', () => {
      const paginator = new PaginationManager()

      // Simulate some usage
      paginator.currentPage = 5
      paginator.hasMore = false
      paginator.loading = true
      paginator.total = 100

      // Reset
      paginator.reset()

      expect(paginator.currentPage).toBe(0)
      expect(paginator.hasMore).toBe(true)
      expect(paginator.loading).toBe(false)
      expect(paginator.total).toBe(0)
    })
  })

  describe('canLoadMore()', () => {
    it('should return true when hasMore and not loading', () => {
      const paginator = new PaginationManager()

      expect(paginator.canLoadMore()).toBe(true)
    })

    it('should return false when loading', () => {
      const paginator = new PaginationManager()
      paginator.loading = true

      expect(paginator.canLoadMore()).toBe(false)
    })

    it('should return false when no more data', () => {
      const paginator = new PaginationManager()
      paginator.hasMore = false

      expect(paginator.canLoadMore()).toBe(false)
    })

    it('should return false when both loading and no more data', () => {
      const paginator = new PaginationManager()
      paginator.loading = true
      paginator.hasMore = false

      expect(paginator.canLoadMore()).toBe(false)
    })
  })

  describe('loadPage()', () => {
    it('should load first page successfully', async () => {
      const paginator = new PaginationManager({ pageSize: 10 })

      const mockFetch = vi.fn().mockResolvedValue({
        success: true,
        data: Array(10).fill(null).map((_, i) => ({ id: i })),
        total: 100
      })

      const result = await paginator.loadPage(mockFetch)

      expect(mockFetch).toHaveBeenCalledWith({ limit: 10, offset: 0 })
      expect(result.data.length).toBe(10)
      expect(result.hasMore).toBe(true)
      expect(result.currentPage).toBe(1)
      expect(paginator.currentPage).toBe(1)
    })

    it('should load multiple pages', async () => {
      const paginator = new PaginationManager({ pageSize: 10 })

      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          success: true,
          data: Array(10).fill(null).map((_, i) => ({ id: i })),
          total: 25
        })
        .mockResolvedValueOnce({
          success: true,
          data: Array(10).fill(null).map((_, i) => ({ id: i + 10 })),
          total: 25
        })

      // First page
      await paginator.loadPage(mockFetch)
      expect(paginator.currentPage).toBe(1)

      // Second page
      await paginator.loadPage(mockFetch)
      expect(paginator.currentPage).toBe(2)
      expect(mockFetch).toHaveBeenCalledWith({ limit: 10, offset: 10 })
    })

    it('should set hasMore to false when data length < pageSize', async () => {
      const paginator = new PaginationManager({ pageSize: 10 })

      const mockFetch = vi.fn().mockResolvedValue({
        success: true,
        data: Array(5).fill(null).map((_, i) => ({ id: i })), // Only 5 items
        total: 5
      })

      const result = await paginator.loadPage(mockFetch)

      expect(result.hasMore).toBe(false)
      expect(paginator.hasMore).toBe(false)
    })

    it('should set hasMore to false when reached total', async () => {
      const paginator = new PaginationManager({ pageSize: 10 })

      const mockFetch = vi.fn().mockResolvedValue({
        success: true,
        data: Array(10).fill(null).map((_, i) => ({ id: i })),
        total: 10
      })

      const result = await paginator.loadPage(mockFetch)

      expect(result.hasMore).toBe(false)
      expect(paginator.hasMore).toBe(false)
    })

    it('should not load when already loading', async () => {
      const paginator = new PaginationManager({ pageSize: 10 })
      paginator.loading = true

      const mockFetch = vi.fn()

      const result = await paginator.loadPage(mockFetch)

      expect(mockFetch).not.toHaveBeenCalled()
      expect(result.data).toEqual([])
      expect(result.hasMore).toBe(false)
    })

    it('should not load when no more data', async () => {
      const paginator = new PaginationManager({ pageSize: 10 })
      paginator.hasMore = false

      const mockFetch = vi.fn()

      const result = await paginator.loadPage(mockFetch)

      expect(mockFetch).not.toHaveBeenCalled()
      expect(result.data).toEqual([])
    })

    it('should handle fetch errors', async () => {
      const paginator = new PaginationManager({ pageSize: 10 })

      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await paginator.loadPage(mockFetch)

      expect(result.data).toEqual([])
      expect(result.hasMore).toBe(false)
      expect(result.error).toBe('Network error')
      expect(paginator.hasMore).toBe(false)
    })

    it('should handle API errors', async () => {
      const paginator = new PaginationManager({ pageSize: 10 })

      const mockFetch = vi.fn().mockResolvedValue({
        success: false,
        error: 'API Error'
      })

      const result = await paginator.loadPage(mockFetch)

      expect(result.data).toEqual([])
      expect(result.hasMore).toBe(false)
      expect(result.error).toBe('API Error')
    })

    it('should reset loading flag after success', async () => {
      const paginator = new PaginationManager({ pageSize: 10 })

      const mockFetch = vi.fn().mockResolvedValue({
        success: true,
        data: Array(10).fill(null).map((_, i) => ({ id: i })),
        total: 100
      })

      await paginator.loadPage(mockFetch)

      expect(paginator.loading).toBe(false)
    })

    it('should reset loading flag after error', async () => {
      const paginator = new PaginationManager({ pageSize: 10 })

      const mockFetch = vi.fn().mockRejectedValue(new Error('Test error'))

      await paginator.loadPage(mockFetch)

      expect(paginator.loading).toBe(false)
    })
  })

  describe('setupInfiniteScroll()', () => {
    it('should setup scroll listener', () => {
      const paginator = new PaginationManager()
      const mockContainer = testUtils.createMockElement('div')
      const mockOnLoadMore = vi.fn()

      const cleanup = paginator.setupInfiniteScroll({
        container: mockContainer,
        onLoadMore: mockOnLoadMore
      })

      expect(cleanup).toBeTypeOf('function')
      expect(paginator.scrollCleanup).toBeTypeOf('function')
    })

    it('should return null for invalid container', () => {
      const paginator = new PaginationManager()

      const cleanup = paginator.setupInfiniteScroll({
        container: null,
        onLoadMore: vi.fn()
      })

      expect(cleanup).toBe(null)
    })

    it('should return null for invalid onLoadMore', () => {
      const paginator = new PaginationManager()
      const mockContainer = testUtils.createMockElement('div')

      const cleanup = paginator.setupInfiniteScroll({
        container: mockContainer,
        onLoadMore: 'not a function'
      })

      expect(cleanup).toBe(null)
    })

    it('should use default threshold', () => {
      const paginator = new PaginationManager()
      const mockContainer = testUtils.createMockElement('div')

      paginator.setupInfiniteScroll({
        container: mockContainer,
        onLoadMore: vi.fn()
      })

      // Threshold default is 300
      expect(paginator.scrollCleanup).toBeDefined()
    })

    it('should use custom threshold', () => {
      const paginator = new PaginationManager()
      const mockContainer = testUtils.createMockElement('div')

      paginator.setupInfiniteScroll({
        container: mockContainer,
        onLoadMore: vi.fn(),
        threshold: 500
      })

      expect(paginator.scrollCleanup).toBeDefined()
    })
  })

  describe('cleanup()', () => {
    it('should cleanup scroll listeners', () => {
      const paginator = new PaginationManager()
      const mockContainer = testUtils.createMockElement('div')
      const mockOnLoadMore = vi.fn()

      paginator.setupInfiniteScroll({
        container: mockContainer,
        onLoadMore: mockOnLoadMore
      })

      expect(paginator.scrollCleanup).not.toBe(null)

      paginator.cleanup()

      expect(paginator.scrollCleanup).toBe(null)
    })

    it('should not throw if no scroll listener setup', () => {
      const paginator = new PaginationManager()

      expect(() => {
        paginator.cleanup()
      }).not.toThrow()
    })
  })

  describe('getStats()', () => {
    it('should return initial stats', () => {
      const paginator = new PaginationManager({ pageSize: 20 })

      const stats = paginator.getStats()

      expect(stats).toEqual({
        currentPage: 0,
        pageSize: 20,
        total: 0,
        hasMore: true,
        loading: false,
        loadedItems: 0
      })
    })

    it('should return updated stats after loading', async () => {
      const paginator = new PaginationManager({ pageSize: 10 })

      const mockFetch = vi.fn().mockResolvedValue({
        success: true,
        data: Array(10).fill(null).map((_, i) => ({ id: i })),
        total: 50
      })

      await paginator.loadPage(mockFetch)

      const stats = paginator.getStats()

      expect(stats.currentPage).toBe(1)
      expect(stats.total).toBe(50)
      expect(stats.loadedItems).toBe(10)
      expect(stats.hasMore).toBe(true)
      expect(stats.loading).toBe(false)
    })

    it('should calculate loadedItems correctly', async () => {
      const paginator = new PaginationManager({ pageSize: 10 })

      const mockFetch = vi.fn().mockResolvedValue({
        success: true,
        data: Array(10).fill(null).map((_, i) => ({ id: i })),
        total: 100
      })

      // Load 3 pages
      await paginator.loadPage(mockFetch)
      await paginator.loadPage(mockFetch)
      await paginator.loadPage(mockFetch)

      const stats = paginator.getStats()

      expect(stats.loadedItems).toBe(30)
      expect(stats.currentPage).toBe(3)
    })
  })

  describe('Real-world Scenarios', () => {
    it('should handle pagination for 100 items with pageSize 20', async () => {
      const paginator = new PaginationManager({ pageSize: 20 })

      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          success: true,
          data: Array(20).fill(null).map((_, i) => ({ id: i })),
          total: 100
        })
        .mockResolvedValueOnce({
          success: true,
          data: Array(20).fill(null).map((_, i) => ({ id: i + 20 })),
          total: 100
        })

      // Page 1
      const result1 = await paginator.loadPage(mockFetch)
      expect(result1.data.length).toBe(20)
      expect(result1.hasMore).toBe(true)

      // Page 2
      const result2 = await paginator.loadPage(mockFetch)
      expect(result2.data.length).toBe(20)
      expect(result2.hasMore).toBe(true)

      // Total loaded
      expect(paginator.getStats().loadedItems).toBe(40)
    })

    it('should handle last page with partial data', async () => {
      const paginator = new PaginationManager({ pageSize: 20 })

      const mockFetch = vi.fn().mockResolvedValue({
        success: true,
        data: Array(15).fill(null).map((_, i) => ({ id: i })), // Only 15 items
        total: 15
      })

      const result = await paginator.loadPage(mockFetch)

      expect(result.data.length).toBe(15)
      expect(result.hasMore).toBe(false)
      expect(paginator.hasMore).toBe(false)
    })

    it('should handle empty result', async () => {
      const paginator = new PaginationManager({ pageSize: 20 })

      const mockFetch = vi.fn().mockResolvedValue({
        success: true,
        data: [],
        total: 0
      })

      const result = await paginator.loadPage(mockFetch)

      expect(result.data).toEqual([])
      expect(result.hasMore).toBe(false)
    })

    it('should handle reset and reload', async () => {
      const paginator = new PaginationManager({ pageSize: 10 })

      const mockFetch = vi.fn().mockResolvedValue({
        success: true,
        data: Array(10).fill(null).map((_, i) => ({ id: i })),
        total: 100
      })

      // Load first page
      await paginator.loadPage(mockFetch)
      expect(paginator.currentPage).toBe(1)

      // Reset
      paginator.reset()
      expect(paginator.currentPage).toBe(0)

      // Load again
      await paginator.loadPage(mockFetch)
      expect(paginator.currentPage).toBe(1)
    })
  })

  describe('Performance', () => {
    it('should handle large dataset pagination', async () => {
      const paginator = new PaginationManager({ pageSize: 100 })

      const mockFetch = vi.fn().mockResolvedValue({
        success: true,
        data: Array(100).fill(null).map((_, i) => ({ id: i })),
        total: 10000
      })

      const start = Date.now()
      await paginator.loadPage(mockFetch)
      const end = Date.now()

      expect(end - start).toBeLessThan(100) // Should be fast
      expect(paginator.getStats().loadedItems).toBe(100)
    })

    it('should prevent concurrent loadPage calls', async () => {
      const paginator = new PaginationManager({ pageSize: 10 })

      const mockFetch = vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: Array(10).fill(null).map((_, i) => ({ id: i })),
          total: 100
        }), 50))
      )

      // Try to load simultaneously
      const promise1 = paginator.loadPage(mockFetch)

      // Wait a tiny bit to ensure loading flag is set
      await new Promise(resolve => setTimeout(resolve, 5))

      const promise2 = paginator.loadPage(mockFetch)

      const [result1, result2] = await Promise.all([promise1, promise2])

      // First call should succeed
      expect(result1.data.length).toBe(10)

      // Second call should be blocked (empty data)
      expect(result2.data).toEqual([])
      expect(result2.hasMore).toBe(false)

      // Should only call fetch once (second call blocked by loading flag)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })
})
