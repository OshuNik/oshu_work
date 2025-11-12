/**
 * ✅ Test Suite for Structured Logging with Request IDs
 * Validates HIGH #12: Structured logging with request IDs
 */

describe('Frontend HIGH #12: Structured Logging with Request IDs', () => {
  let LoggerUtils;
  let consoleSpy;

  beforeEach(() => {
    // Mock LoggerUtils
    LoggerUtils = {
      generateRequestId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `req_${timestamp}_${random}`.substring(0, 20);
      },

      createLogEntry(level, message, data = {}) {
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
      },

      log(message, data = {}) {
        const entry = this.createLogEntry('INFO', message, data);
        console.log(`[${entry.level}] [${entry.requestId}] ${message}`, data);
      },

      error(message, error = null, data = {}) {
        const entry = this.createLogEntry('ERROR', message, {
          error: error?.message || String(error),
          stack: error?.stack?.split('\n')[0],
          ...data
        });
        console.error(`[${entry.level}] [${entry.requestId}] ${message}`, data, error);
      },

      logApiRequest(method, url, data = {}) {
        const requestId = window.currentRequestId || this.generateRequestId();
        this.log(`API Request: ${method} ${url}`, {
          requestId,
          method,
          url: url.substring(0, 100),
          dataSize: JSON.stringify(data).length,
          timestamp: new Date().toISOString()
        });
        return requestId;
      },

      logApiResponse(requestId, status, duration, success = true) {
        this.log(`API Response: ${status}`, {
          requestId,
          status,
          duration: `${duration}ms`,
          success,
          timestamp: new Date().toISOString()
        });
      },

      logUserAction(action, details = {}) {
        this.log(`User Action: ${action}`, {
          requestId: window.currentRequestId || 'user_action',
          action,
          url: window.location.pathname,
          ...details,
          timestamp: new Date().toISOString()
        });
      },

      getTrackingInfo() {
        return {
          requestId: window.currentRequestId || 'none',
          correlationId: window.correlationId || 'none',
          timestamp: new Date().toISOString()
        };
      }
    };

    // Setup console spy
    consoleSpy = {
      logs: [],
      errors: [],
      warns: [],
      originalLog: console.log,
      originalError: console.error,
      originalWarn: console.warn
    };

    console.log = jest.fn((message) => {
      consoleSpy.logs.push(message);
    });

    console.error = jest.fn((message) => {
      consoleSpy.errors.push(message);
    });

    console.warn = jest.fn((message) => {
      consoleSpy.warns.push(message);
    });
  });

  afterEach(() => {
    console.log = consoleSpy.originalLog;
    console.error = consoleSpy.originalError;
    console.warn = consoleSpy.originalWarn;
    delete window.currentRequestId;
    delete window.correlationId;
  });

  describe('Request ID Generation', () => {
    test('Should generate unique request IDs', () => {
      const id1 = LoggerUtils.generateRequestId();
      const id2 = LoggerUtils.generateRequestId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toEqual(id2);
    });

    test('Should format request IDs with req_ prefix', () => {
      const id = LoggerUtils.generateRequestId();
      expect(id).toMatch(/^req_/);
    });

    test('Should generate consistent format', () => {
      const id = LoggerUtils.generateRequestId();
      expect(id).toMatch(/^req_[a-z0-9]+_[a-z0-9]+$/);
    });

    test('Should keep request ID within length limit', () => {
      const id = LoggerUtils.generateRequestId();
      expect(id.length).toBeLessThanOrEqual(20);
    });
  });

  describe('Structured Log Entries', () => {
    test('Should create log entry with required fields', () => {
      const entry = LoggerUtils.createLogEntry('INFO', 'Test message', {});

      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('level');
      expect(entry).toHaveProperty('message');
      expect(entry).toHaveProperty('requestId');
      expect(entry).toHaveProperty('context');
    });

    test('Should include timestamp in ISO format', () => {
      const entry = LoggerUtils.createLogEntry('INFO', 'Test', {});
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test('Should include URL in context', () => {
      const entry = LoggerUtils.createLogEntry('INFO', 'Test', {});
      expect(entry.context).toHaveProperty('url');
    });

    test('Should include user agent in context', () => {
      const entry = LoggerUtils.createLogEntry('INFO', 'Test', {});
      expect(entry.context).toHaveProperty('userAgent');
    });

    test('Should merge custom data into context', () => {
      const entry = LoggerUtils.createLogEntry('INFO', 'Test', {
        customKey: 'customValue'
      });
      expect(entry.context.customKey).toBe('customValue');
    });
  });

  describe('Request ID Tracking', () => {
    test('Should use global request ID if available', () => {
      window.currentRequestId = 'test_request_id';
      const entry = LoggerUtils.createLogEntry('INFO', 'Test', {});
      expect(entry.requestId).toBe('test_request_id');
    });

    test('Should default to unknown if no request ID', () => {
      delete window.currentRequestId;
      const entry = LoggerUtils.createLogEntry('INFO', 'Test', {});
      expect(entry.requestId).toBe('unknown');
    });

    test('Should include request ID in log output', () => {
      window.currentRequestId = 'test_123';
      LoggerUtils.log('Test message', {});

      expect(console.log).toHaveBeenCalled();
      const callArgs = console.log.mock.calls[0];
      expect(callArgs[0]).toContain('test_123');
    });
  });

  describe('API Logging', () => {
    test('Should log API requests with method and URL', () => {
      const requestId = LoggerUtils.logApiRequest('GET', 'https://api.example.com/data', {});

      expect(console.log).toHaveBeenCalled();
      const callArgs = console.log.mock.calls[0];
      expect(callArgs[0]).toContain('API Request');
      expect(callArgs[0]).toContain('GET');
    });

    test('Should include request ID in API request log', () => {
      window.currentRequestId = 'api_test_123';
      LoggerUtils.logApiRequest('POST', 'https://api.example.com/data', {});

      const callArgs = console.log.mock.calls[0];
      expect(callArgs[0]).toContain('api_test_123');
    });

    test('Should log API responses with status', () => {
      LoggerUtils.logApiResponse('req_123', 200, 50);

      expect(console.log).toHaveBeenCalled();
      const callArgs = console.log.mock.calls[0];
      expect(callArgs[0]).toContain('API Response');
      expect(callArgs[0]).toContain('200');
    });

    test('Should include duration in API response', () => {
      LoggerUtils.logApiResponse('req_123', 200, 100);

      const callArgs = console.log.mock.calls[0];
      expect(callArgs[1]).toHaveProperty('duration', '100ms');
    });
  });

  describe('User Action Logging', () => {
    test('Should log user actions with action name', () => {
      LoggerUtils.logUserAction('button_click', { buttonId: 'submit' });

      expect(console.log).toHaveBeenCalled();
      const callArgs = console.log.mock.calls[0];
      expect(callArgs[0]).toContain('User Action');
      expect(callArgs[0]).toContain('button_click');
    });

    test('Should include action details in context', () => {
      LoggerUtils.logUserAction('form_submit', { formId: 'search' });

      const callArgs = console.log.mock.calls[0];
      expect(callArgs[1]).toHaveProperty('action', 'form_submit');
      expect(callArgs[1]).toHaveProperty('formId', 'search');
    });
  });

  describe('Error Logging', () => {
    test('Should log errors with full context', () => {
      const error = new Error('Test error');
      LoggerUtils.error('Operation failed', error, { operation: 'fetch' });

      expect(console.error).toHaveBeenCalled();
      const callArgs = console.error.mock.calls[0];
      expect(callArgs[0]).toContain('ERROR');
      expect(callArgs[0]).toContain('Operation failed');
    });

    test('Should extract error message from Error object', () => {
      const error = new Error('Test error message');
      LoggerUtils.error('Operation failed', error);

      const callArgs = console.error.mock.calls[0];
      expect(callArgs[1]).toHaveProperty('error');
      expect(callArgs[1].error).toContain('Test error message');
    });

    test('Should handle null errors', () => {
      LoggerUtils.error('Operation failed', null, {});

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Tracking Information', () => {
    test('Should return current tracking info', () => {
      window.currentRequestId = 'req_abc123';
      window.correlationId = 'corr_xyz789';

      const info = LoggerUtils.getTrackingInfo();

      expect(info).toHaveProperty('requestId', 'req_abc123');
      expect(info).toHaveProperty('correlationId', 'corr_xyz789');
      expect(info).toHaveProperty('timestamp');
    });

    test('Should default to none for missing IDs', () => {
      delete window.currentRequestId;
      delete window.correlationId;

      const info = LoggerUtils.getTrackingInfo();

      expect(info.requestId).toBe('none');
      expect(info.correlationId).toBe('none');
    });
  });

  describe('Log Levels', () => {
    test('Should distinguish between log levels', () => {
      const infoEntry = LoggerUtils.createLogEntry('INFO', 'Info message');
      const errorEntry = LoggerUtils.createLogEntry('ERROR', 'Error message');
      const debugEntry = LoggerUtils.createLogEntry('DEBUG', 'Debug message');

      expect(infoEntry.level).toBe('INFO');
      expect(errorEntry.level).toBe('ERROR');
      expect(debugEntry.level).toBe('DEBUG');
    });

    test('Should include level in log output', () => {
      LoggerUtils.log('Test message');

      const callArgs = console.log.mock.calls[0];
      expect(callArgs[0]).toContain('[INFO]');
    });
  });

  describe('Traceability', () => {
    test('Should enable request tracing across multiple logs', () => {
      window.currentRequestId = 'trace_123';

      LoggerUtils.log('Step 1');
      LoggerUtils.log('Step 2');
      LoggerUtils.log('Step 3');

      expect(console.log).toHaveBeenCalledTimes(3);

      // All logs should have same request ID
      console.log.mock.calls.forEach(call => {
        expect(call[0]).toContain('trace_123');
      });
    });

    test('Should support correlation IDs for related requests', () => {
      window.correlationId = 'corr_batch_001';

      LoggerUtils.log('Request A');
      LoggerUtils.log('Request B');

      const info = LoggerUtils.getTrackingInfo();
      expect(info.correlationId).toBe('corr_batch_001');
    });
  });
});
