// pagination-manager.js - Infinite scroll & pagination

(function() {
  'use strict';

  const CFG = window.APP_CONFIG || {};

  class PaginationManager {
    constructor(options = {}) {
      this.pageSize = options.pageSize || 20;
      this.currentPage = 0;
      this.hasMore = true;
      this.loading = false;
      this.total = 0;
      this.scrollCleanup = null;
    }

    reset() {
      this.currentPage = 0;
      this.hasMore = true;
      this.loading = false;
      this.total = 0;
    }

    canLoadMore() {
      return this.hasMore && !this.loading;
    }

    async loadPage(fetchFunction) {
      if (!this.canLoadMore()) {
        return { data: [], hasMore: false };
      }

      this.loading = true;

      try {
        const offset = this.currentPage * this.pageSize;

        const result = await fetchFunction({
          limit: this.pageSize,
          offset: offset
        });

        if (result.success && Array.isArray(result.data)) {
          this.currentPage++;
          this.total = result.total || 0;

          if (result.data.length < this.pageSize) {
            this.hasMore = false;
          }

          if (this.total > 0 && (this.currentPage * this.pageSize >= this.total)) {
            this.hasMore = false;
          }

          return {
            data: result.data,
            hasMore: this.hasMore,
            total: this.total,
            currentPage: this.currentPage
          };
        }

        this.hasMore = false;
        return { data: [], hasMore: false, error: result.error };

      } catch (error) {
        console.error('[Pagination] Error loading page:', error);
        this.hasMore = false;
        return { data: [], hasMore: false, error: error.message };
      } finally {
        this.loading = false;
      }
    }

    setupInfiniteScroll(options = {}) {
      const {
        container,
        onLoadMore,
        threshold = 300
      } = options;

      if (!container || typeof onLoadMore !== 'function') {
        console.warn('[Pagination] Invalid infinite scroll setup');
        return null;
      }

      const handleScroll = () => {
        if (this.loading || !this.hasMore) {
          return;
        }

        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = document.documentElement.clientHeight;

        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

        if (distanceFromBottom < threshold) {
          console.log('[Pagination] Near bottom, loading more...');
          onLoadMore();
        }
      };

      let scrollTimeout;
      const throttledScroll = () => {
        if (scrollTimeout) return;

        scrollTimeout = setTimeout(() => {
          handleScroll();
          scrollTimeout = null;
        }, 200);
      };

      window.addEventListener('scroll', throttledScroll, { passive: true });

      this.scrollCleanup = () => {
        window.removeEventListener('scroll', throttledScroll);
        if (scrollTimeout) clearTimeout(scrollTimeout);
      };

      return this.scrollCleanup;
    }

    cleanup() {
      if (this.scrollCleanup) {
        this.scrollCleanup();
        this.scrollCleanup = null;
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
      };
    }
  }

  window.PaginationManager = PaginationManager;

  console.log('✅ [Pagination] Manager loaded');
})();
