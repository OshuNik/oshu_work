/**
 * ✅ Structured Logging Utility with Request IDs
 * Addresses HIGH #12: Structured logging with request IDs for traceability
 */

class LoggerUtils {
  static generateRequestId() {
    // Generate a unique request ID combining timestamp and random hex
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `req_${timestamp}_${random}`.substring(0, 20);
  }

  /**
   * Create structured log entry with context
   */
  static createLogEntry(level, message, data = {}) {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      requestId: window.currentRequestId || 'unknown',
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent.substring(0, 50),
        ...data
      }
    };
  }

  /**
   * Log with structured format
   */
  static log(message, data = {}) {
    const entry = this.createLogEntry('INFO', message, data);
    console.log(`[${entry.level}] [${entry.requestId}] ${message}`, data);
  }

  /**
   * Warn with structured format
   */
  static warn(message, data = {}) {
    const entry = this.createLogEntry('WARN', message, data);
    console.warn(`[${entry.level}] [${entry.requestId}] ${message}`, data);
  }

  /**
   * Error with structured format
   */
  static error(message, error = null, data = {}) {
    const entry = this.createLogEntry('ERROR', message, {
      error: error?.message || String(error),
      stack: error?.stack?.split('\n')[0],
      ...data
    });
    console.error(`[${entry.level}] [${entry.requestId}] ${message}`, data, error);
  }

  /**
   * Debug with structured format
   */
  static debug(message, data = {}) {
    if (window.APP_CONFIG?.DEBUG_MODE) {
      const entry = this.createLogEntry('DEBUG', message, data);
      console.debug(`[${entry.level}] [${entry.requestId}] ${message}`, data);
    }
  }

  /**
   * Wrap async operation with request ID tracking
   */
  static async withRequestId(operationName, asyncFn, metadata = {}) {
    const requestId = this.generateRequestId();
    const previousId = window.currentRequestId;

    try {
      window.currentRequestId = requestId;

      this.log(`Starting: ${operationName}`, {
        requestId,
        ...metadata
      });

      const result = await asyncFn(requestId);

      this.log(`Completed: ${operationName}`, {
        requestId,
        duration: `${Date.now() - parseInt(requestId.substring(4, 13), 36)}ms`,
        ...metadata
      });

      return result;
    } catch (error) {
      this.error(`Failed: ${operationName}`, error, {
        requestId,
        ...metadata
      });
      throw error;
    } finally {
      window.currentRequestId = previousId;
    }
  }

  /**
   * Log API request with full context
   */
  static logApiRequest(method, url, data = {}) {
    const requestId = window.currentRequestId || this.generateRequestId();

    this.log(`API Request: ${method} ${url}`, {
      requestId,
      method,
      url: url.substring(0, 100), // Truncate long URLs
      dataSize: JSON.stringify(data).length,
      timestamp: new Date().toISOString()
    });

    return requestId;
  }

  /**
   * Log API response with status
   */
  static logApiResponse(requestId, status, duration, success = true) {
    this.log(`API Response: ${status}`, {
      requestId,
      status,
      duration: `${duration}ms`,
      success,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log user action with context
   */
  static logUserAction(action, details = {}) {
    this.log(`User Action: ${action}`, {
      requestId: window.currentRequestId || 'user_action',
      action,
      url: window.location.pathname,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log error event with full stack
   */
  static logErrorEvent(eventType, error, context = {}) {
    this.error(`Error Event: ${eventType}`, error, {
      requestId: window.currentRequestId || 'error_event',
      eventType,
      errorName: error?.name,
      errorMessage: error?.message,
      url: window.location.href,
      ...context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Create performance metrics log
   */
  static logPerformance(operation, metrics = {}) {
    this.log(`Performance: ${operation}`, {
      requestId: window.currentRequestId || 'perf',
      operation,
      ...metrics,
      memory: performance?.memory?.usedJSHeapSize
        ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(2)}MB`
        : 'N/A',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Set correlation context for multiple operations
   */
  static setCorrelationId(correlationId) {
    window.correlationId = correlationId;
    this.log('Correlation ID set', { correlationId });
  }

  /**
   * Clear correlation context
   */
  static clearCorrelationId() {
    window.correlationId = null;
  }

  /**
   * Get current tracking info
   */
  static getTrackingInfo() {
    return {
      requestId: window.currentRequestId || 'none',
      correlationId: window.correlationId || 'none',
      timestamp: new Date().toISOString()
    };
  }
}

// Initialize global logger
window.LoggerUtils = LoggerUtils;

// Override console methods to add request ID
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
const originalDebug = console.debug;

console.log = function(...args) {
  const requestId = window.currentRequestId ? `[${window.currentRequestId}]` : '';
  originalLog(requestId, ...args);
};

console.warn = function(...args) {
  const requestId = window.currentRequestId ? `[${window.currentRequestId}]` : '';
  originalWarn(requestId, ...args);
};

console.error = function(...args) {
  const requestId = window.currentRequestId ? `[${window.currentRequestId}]` : '';
  originalError(requestId, ...args);
};

console.debug = function(...args) {
  const requestId = window.currentRequestId ? `[${window.currentRequestId}]` : '';
  originalDebug(requestId, ...args);
};
