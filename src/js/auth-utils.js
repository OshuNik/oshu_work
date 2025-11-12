/**
 * ✅ Centralized Authentication & JWT Validation Utilities
 * Prevents redundant JWT/auth error checking across the codebase
 * Addresses HIGH #8: JWT validation deduplication
 */

class AuthUtils {
  /**
   * Check if HTTP status code indicates authentication error
   */
  static isAuthErrorStatus(status) {
    return status === 401 || status === 403;
  }

  /**
   * Check if error message/response indicates authentication failure
   */
  static isAuthErrorMessage(message) {
    if (!message || typeof message !== 'string') {
      return false;
    }

    const authPatterns = [
      'auth',
      'unauthorized',
      '401',
      '403',
      'permission',
      'token',
      'invalid.*token',
      'expired.*token',
      'access.*denied'
    ];

    const lowerMessage = message.toLowerCase();
    return authPatterns.some(pattern => {
      try {
        return new RegExp(pattern, 'i').test(lowerMessage);
      } catch (e) {
        return lowerMessage.includes(pattern);
      }
    });
  }

  /**
   * Check if error is authentication-related
   */
  static isAuthError(error) {
    if (!error) {
      return false;
    }

    // Check HTTP status code
    if (error.status && this.isAuthErrorStatus(error.status)) {
      return true;
    }

    // Check error message
    if (error.message && this.isAuthErrorMessage(error.message)) {
      return true;
    }

    return false;
  }

  /**
   * Validate JWT token structure (basic validation)
   * JWT format: header.payload.signature
   */
  static isValidJWTFormat(token) {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    // Check if each part is valid base64
    return parts.every(part => {
      try {
        // Base64 decode and check if it's valid JSON
        const decoded = atob(part);
        JSON.parse(decoded);
        return true;
      } catch (e) {
        return false;
      }
    });
  }

  /**
   * Handle authentication error response
   * Returns standardized error object with retry instructions
   */
  static handleAuthError(error) {
    const isRetryable = false;
    let userMessage = 'Проблема с авторизацией';

    if (error.status === 401) {
      userMessage = 'Проблема с авторизацией. Перезагрузите страницу';
    } else if (error.status === 403) {
      userMessage = 'Доступ запрещен';
    }

    return {
      isAuthError: true,
      isRetryable,
      status: error.status || 401,
      userMessage,
      timestamp: new Date().toISOString(),
      originalError: error
    };
  }

  /**
   * Clear auth tokens on logout/auth error
   */
  static clearAuthState() {
    try {
      // Remove from localStorage
      localStorage.removeItem('supabase_token');
      localStorage.removeItem('supabase_session');

      // Notify app of auth failure
      document.dispatchEvent(new CustomEvent('auth:expired', {
        detail: { timestamp: new Date().toISOString() }
      }));

      console.log('[AuthUtils] ✅ Auth state cleared');
    } catch (e) {
      console.error('[AuthUtils] Error clearing auth state:', e);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthUtils;
}
