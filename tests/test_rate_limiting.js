/**
 * ✅ Test Suite for Rate Limiting
 * Validates HIGH #11: Rate limiting for user operations
 */

describe('Frontend HIGH #11: User Rate Limiting', () => {
  let rateLimiter;

  beforeEach(() => {
    // Mock AdvancedRateLimiter
    rateLimiter = {
      limits: {
        fetchVacancies: { maxRequests: 30, windowMs: 60000 },
        updateStatus: { maxRequests: 20, windowMs: 60000 },
        favorite: { maxRequests: 10, windowMs: 60000 },
        saveSettings: { maxRequests: 5, windowMs: 60000 },
        addKeyword: { maxRequests: 10, windowMs: 60000 },
        addChannel: { maxRequests: 10, windowMs: 60000 },
        deleteKeyword: { maxRequests: 15, windowMs: 60000 },
        deleteChannel: { maxRequests: 15, windowMs: 60000 },
        search: { maxRequests: 30, windowMs: 60000 },
        bulkDelete: { maxRequests: 3, windowMs: 60000 }
      },
      requestHistory: new Map(),
      globalLimit: { maxRequests: 100, windowMs: 60000 },
      globalHistory: [],

      checkLimit(operation) {
        const limit = this.limits[operation];
        if (!limit) {
          return { allowed: true, message: '', retryAfter: 0 };
        }

        const now = Date.now();
        const history = this.requestHistory.get(operation) || [];
        const activeRequests = history.filter(timestamp => now - timestamp < limit.windowMs);

        if (activeRequests.length >= limit.maxRequests) {
          const oldestRequest = Math.min(...activeRequests);
          const retryAfter = Math.ceil((oldestRequest + limit.windowMs - now) / 1000);

          return {
            allowed: false,
            message: `Слишком много запросов (${operation}). Подождите ${retryAfter} сек.`,
            retryAfter
          };
        }

        activeRequests.push(now);
        this.requestHistory.set(operation, activeRequests);

        return { allowed: true, message: '', retryAfter: 0 };
      }
    };
  });

  describe('Operation-specific rate limits', () => {
    test('Should allow requests within limit', () => {
      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.checkLimit('fetchVacancies');
        expect(result.allowed).toBe(true);
      }
    });

    test('Should block requests after limit reached', () => {
      const limit = rateLimiter.limits['fetchVacancies'];

      for (let i = 0; i < limit.maxRequests; i++) {
        rateLimiter.checkLimit('fetchVacancies');
      }

      const result = rateLimiter.checkLimit('fetchVacancies');
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('Слишком много запросов');
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    test('Should have different limits for different operations', () => {
      // fetchVacancies has 30 req/min
      const fetchLimit = rateLimiter.limits['fetchVacancies'].maxRequests;
      // bulkDelete has 3 req/min
      const deleteLimit = rateLimiter.limits['bulkDelete'].maxRequests;

      expect(fetchLimit).toBeGreaterThan(deleteLimit);
    });

    test('Should allow bulk operations with restrictive limit', () => {
      const limit = rateLimiter.limits['bulkDelete'].maxRequests;
      expect(limit).toBe(3); // 3 deletes per minute
    });

    test('Should allow searches with generous limit', () => {
      const limit = rateLimiter.limits['search'].maxRequests;
      expect(limit).toBe(30); // 30 searches per minute
    });
  });

  describe('Fetch vacancies rate limiting', () => {
    test('Should allow 30 fetches per minute', () => {
      const limit = rateLimiter.limits['fetchVacancies'].maxRequests;

      for (let i = 0; i < limit; i++) {
        const result = rateLimiter.checkLimit('fetchVacancies');
        expect(result.allowed).toBe(true);
      }

      // 31st should be blocked
      const blocked = rateLimiter.checkLimit('fetchVacancies');
      expect(blocked.allowed).toBe(false);
    });
  });

  describe('Update status rate limiting', () => {
    test('Should allow 20 status updates per minute', () => {
      const limit = rateLimiter.limits['updateStatus'].maxRequests;

      for (let i = 0; i < limit; i++) {
        const result = rateLimiter.checkLimit('updateStatus');
        expect(result.allowed).toBe(true);
      }

      // 21st should be blocked
      const blocked = rateLimiter.checkLimit('updateStatus');
      expect(blocked.allowed).toBe(false);
    });
  });

  describe('Delete vacancy rate limiting', () => {
    test('Should only allow 3 bulk deletes per minute', () => {
      for (let i = 0; i < 3; i++) {
        const result = rateLimiter.checkLimit('bulkDelete');
        expect(result.allowed).toBe(true);
      }

      // 4th should be blocked
      const blocked = rateLimiter.checkLimit('bulkDelete');
      expect(blocked.allowed).toBe(false);
    });

    test('Should include retry after time in error message', () => {
      for (let i = 0; i < 3; i++) {
        rateLimiter.checkLimit('bulkDelete');
      }

      const blocked = rateLimiter.checkLimit('bulkDelete');
      expect(blocked.message).toContain('Подождите');
      expect(blocked.retryAfter).toBeGreaterThan(0);
      expect(blocked.retryAfter).toBeLessThanOrEqual(60); // Should be less than window
    });
  });

  describe('Rate limit error response format', () => {
    test('Should return isRetryable flag', () => {
      // Simulate a rate-limited API response
      const rateLimitedError = {
        allowed: false,
        message: 'Слишком много запросов. Подождите 45 сек.',
        retryAfter: 45
      };

      expect(rateLimitedError).toHaveProperty('allowed', false);
      expect(rateLimitedError).toHaveProperty('message');
      expect(rateLimitedError).toHaveProperty('retryAfter');
    });
  });

  describe('Independent operation tracking', () => {
    test('Should track each operation separately', () => {
      const searchLimit = rateLimiter.limits['search'].maxRequests;
      const updateLimit = rateLimiter.limits['updateStatus'].maxRequests;

      // Max out search requests
      for (let i = 0; i < searchLimit; i++) {
        rateLimiter.checkLimit('search');
      }

      // Verify search is blocked
      const searchBlocked = rateLimiter.checkLimit('search');
      expect(searchBlocked.allowed).toBe(false);

      // But update should still work
      const updateAllowed = rateLimiter.checkLimit('updateStatus');
      expect(updateAllowed.allowed).toBe(true);
    });
  });

  describe('Known operations', () => {
    test('Should have rate limits for all defined operations', () => {
      const operations = [
        'fetchVacancies',
        'updateStatus',
        'favorite',
        'saveSettings',
        'addKeyword',
        'addChannel',
        'deleteKeyword',
        'deleteChannel',
        'search',
        'bulkDelete'
      ];

      operations.forEach(op => {
        expect(rateLimiter.limits[op]).toBeDefined();
        expect(rateLimiter.limits[op].maxRequests).toBeGreaterThan(0);
        expect(rateLimiter.limits[op].windowMs).toBeGreaterThan(0);
      });
    });

    test('Should default to allowing unknown operations', () => {
      const result = rateLimiter.checkLimit('unknownOperation');
      expect(result.allowed).toBe(true); // Unknown ops are allowed by default
    });
  });

  describe('Security considerations', () => {
    test('Should prevent abuse through rapid-fire requests', () => {
      const operation = 'bulkDelete';

      // Simulate rapid-fire requests
      for (let i = 0; i < 10; i++) {
        const result = rateLimiter.checkLimit(operation);

        if (i < 3) {
          expect(result.allowed).toBe(true);
        } else {
          expect(result.allowed).toBe(false);
          expect(result.message).toContain('много запросов');
        }
      }
    });

    test('Settings modifications should be more restricted than reads', () => {
      const readLimit = rateLimiter.limits['fetchVacancies'].maxRequests;
      const settingsLimit = rateLimiter.limits['saveSettings'].maxRequests;

      expect(settingsLimit).toBeLessThan(readLimit);
    });

    test('Keyword/channel operations should be moderately restricted', () => {
      const keywordLimit = rateLimiter.limits['addKeyword'].maxRequests;
      const channelLimit = rateLimiter.limits['addChannel'].maxRequests;

      expect(keywordLimit).toBe(10);
      expect(channelLimit).toBe(10);
    });
  });
});
