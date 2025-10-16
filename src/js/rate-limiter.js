// rate-limiter.js - Client-side Rate Limiting
// Prevents excessive API calls and protects against abuse

(function() {
  'use strict';

  class RateLimiter {
    constructor(options = {}) {
      this.maxCalls = options.maxCalls || 10;
      this.timeWindow = options.timeWindow || 10000; // 10 seconds
      this.calls = [];
      this.blocked = false;
      this.blockedUntil = 0;
    }

    /**
     * Check if rate limit is exceeded
     * @returns {boolean} - true if allowed, false if rate limited
     */
    check() {
      const now = Date.now();

      // Check if currently blocked
      if (this.blocked && now < this.blockedUntil) {
        const remainingMs = this.blockedUntil - now;
        console.warn(`[RateLimiter] Blocked for ${Math.ceil(remainingMs / 1000)}s more`);
        return false;
      }

      // Clear block if time passed
      if (this.blocked && now >= this.blockedUntil) {
        this.blocked = false;
        this.blockedUntil = 0;
        this.calls = [];
        console.log('[RateLimiter] Block cleared');
      }

      // Remove old calls outside the time window
      this.calls = this.calls.filter(timestamp => now - timestamp < this.timeWindow);

      // Check if limit exceeded
      if (this.calls.length >= this.maxCalls) {
        this.blocked = true;
        this.blockedUntil = now + this.timeWindow;
        console.error(`[RateLimiter] Rate limit exceeded! Blocked for ${this.timeWindow / 1000}s`);
        return false;
      }

      // Record this call
      this.calls.push(now);
      return true;
    }

    /**
     * Execute function with rate limiting
     * @param {Function} fn - Function to execute
     * @returns {Promise} - Result or rate limit error
     */
    async execute(fn) {
      if (!this.check()) {
        throw new Error('Rate limit exceeded. Please wait before trying again.');
      }

      try {
        return await fn();
      } catch (error) {
        // Don't count failed requests against rate limit
        this.calls.pop();
        throw error;
      }
    }

    /**
     * Get current rate limit status
     */
    getStatus() {
      const now = Date.now();
      const recentCalls = this.calls.filter(t => now - t < this.timeWindow).length;

      return {
        calls: recentCalls,
        maxCalls: this.maxCalls,
        remaining: Math.max(0, this.maxCalls - recentCalls),
        blocked: this.blocked,
        blockedUntil: this.blockedUntil,
        timeWindow: this.timeWindow
      };
    }

    /**
     * Reset rate limiter
     */
    reset() {
      this.calls = [];
      this.blocked = false;
      this.blockedUntil = 0;
    }
  }

  /**
   * Debounce function - delays execution until after wait period
   */
  function debounce(fn, wait = 300) {
    let timeout;

    return function(...args) {
      const context = this;

      clearTimeout(timeout);

      return new Promise((resolve, reject) => {
        timeout = setTimeout(async () => {
          try {
            const result = await fn.apply(context, args);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, wait);
      });
    };
  }

  /**
   * Throttle function - limits execution to once per wait period
   */
  function throttle(fn, wait = 300) {
    let lastCall = 0;
    let timeout = null;

    return function(...args) {
      const context = this;
      const now = Date.now();

      if (now - lastCall >= wait) {
        lastCall = now;
        return fn.apply(context, args);
      }

      // Queue the call for later
      if (timeout) {
        clearTimeout(timeout);
      }

      return new Promise((resolve) => {
        timeout = setTimeout(() => {
          lastCall = Date.now();
          resolve(fn.apply(context, args));
        }, wait - (now - lastCall));
      });
    };
  }

  // Export to global scope
  window.RateLimiter = RateLimiter;
  window.debounce = debounce;
  window.throttle = throttle;

  // Create global rate limiters for common operations
  window.rateLimiters = {
    // API calls - 10 per 10 seconds
    api: new RateLimiter({ maxCalls: 10, timeWindow: 10000 }),

    // Search - 5 per 5 seconds
    search: new RateLimiter({ maxCalls: 5, timeWindow: 5000 }),

    // Updates - 20 per minute
    update: new RateLimiter({ maxCalls: 20, timeWindow: 60000 }),

    // Heavy operations - 3 per 10 seconds
    heavy: new RateLimiter({ maxCalls: 3, timeWindow: 10000 })
  };

  console.log('✅ [RateLimiter] Rate limiting module loaded');
  console.log('[RateLimiter] Limits: API(10/10s), Search(5/5s), Update(20/60s), Heavy(3/10s)');

})();
