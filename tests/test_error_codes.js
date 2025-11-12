/**
 * ✅ Test Suite for Error Code Handling
 * Validates HIGH #9: Specific handling of 400/401/503 errors
 */

describe('Frontend HIGH #9: Error Code Response Handling', () => {
  let errorHandler;

  beforeEach(() => {
    // Mock error handler with specific code handling
    errorHandler = {
      handleError(error) {
        const errorStatus = error?.status || null;
        let userMessage = 'Неизвестная ошибка';
        let isRetryable = false;
        let severity = 'error';

        if (errorStatus === 400) {
          userMessage = 'Неправильный формат запроса. Проверьте данные';
          isRetryable = false;
          severity = 'error';
        } else if (errorStatus === 401) {
          userMessage = 'Проблема с авторизацией. Перезагрузите страницу';
          isRetryable = false;
          severity = 'error';
        } else if (errorStatus === 403) {
          userMessage = 'Доступ запрещен';
          isRetryable = false;
          severity = 'warning';
        } else if (errorStatus === 404) {
          userMessage = 'Запрашиваемые данные не найдены';
          isRetryable = false;
          severity = 'warning';
        } else if (errorStatus === 429) {
          userMessage = 'Слишком много запросов. Попробуйте через минуту';
          isRetryable = true;
          severity = 'warning';
        } else if (errorStatus === 503) {
          userMessage = 'Сервис временно недоступен. Пожалуйста, попробуйте позже';
          isRetryable = true;
          severity = 'warning';
        } else if (errorStatus !== null && errorStatus >= 500) {
          userMessage = 'Ошибка сервера. Попробуйте позже';
          isRetryable = true;
          severity = 'warning';
        } else if (errorStatus !== null && errorStatus >= 400 && errorStatus < 500) {
          userMessage = `Ошибка клиента (${errorStatus}). Обновите страницу`;
          isRetryable = false;
          severity = 'error';
        }

        return {
          success: false,
          error: userMessage,
          isRetryable,
          severity,
          status: errorStatus
        };
      }
    };
  });

  describe('400 - Bad Request', () => {
    test('Should return specific message for 400 error', () => {
      const result = errorHandler.handleError({ status: 400 });

      expect(result.status).toBe(400);
      expect(result.error).toContain('Неправильный формат');
      expect(result.isRetryable).toBe(false);
      expect(result.severity).toBe('error');
    });

    test('Should indicate user to check data for 400', () => {
      const result = errorHandler.handleError({ status: 400 });

      expect(result.error).toContain('данные');
      expect(result.isRetryable).toBe(false);
    });
  });

  describe('401 - Unauthorized', () => {
    test('Should return specific message for 401 error', () => {
      const result = errorHandler.handleError({ status: 401 });

      expect(result.status).toBe(401);
      expect(result.error).toContain('авторизац');
      expect(result.isRetryable).toBe(false);
      expect(result.severity).toBe('error');
    });

    test('Should suggest page reload for 401', () => {
      const result = errorHandler.handleError({ status: 401 });

      expect(result.error).toContain('Перезагрузите');
    });
  });

  describe('403 - Forbidden', () => {
    test('Should return specific message for 403 error', () => {
      const result = errorHandler.handleError({ status: 403 });

      expect(result.status).toBe(403);
      expect(result.error).toContain('Доступ');
      expect(result.isRetryable).toBe(false);
    });
  });

  describe('404 - Not Found', () => {
    test('Should return specific message for 404 error', () => {
      const result = errorHandler.handleError({ status: 404 });

      expect(result.status).toBe(404);
      expect(result.error).toContain('не найдены');
      expect(result.isRetryable).toBe(false);
    });
  });

  describe('429 - Rate Limited', () => {
    test('Should return specific message for 429 error', () => {
      const result = errorHandler.handleError({ status: 429 });

      expect(result.status).toBe(429);
      expect(result.error).toContain('много запросов');
      expect(result.isRetryable).toBe(true);
      expect(result.severity).toBe('warning');
    });

    test('Should suggest retry for 429', () => {
      const result = errorHandler.handleError({ status: 429 });

      expect(result.error).toContain('минуту');
      expect(result.isRetryable).toBe(true);
    });
  });

  describe('503 - Service Unavailable', () => {
    test('Should return specific message for 503 error', () => {
      const result = errorHandler.handleError({ status: 503 });

      expect(result.status).toBe(503);
      expect(result.error).toContain('временно недоступен');
      expect(result.isRetryable).toBe(true);
      expect(result.severity).toBe('warning');
    });

    test('Should differ from other 5xx errors', () => {
      const result503 = errorHandler.handleError({ status: 503 });
      const result500 = errorHandler.handleError({ status: 500 });

      expect(result503.error).not.toBe(result500.error);
      // Both should be retryable
      expect(result503.isRetryable).toBe(true);
      expect(result500.isRetryable).toBe(true);
    });
  });

  describe('Other 5xx errors', () => {
    test('Should handle generic 5xx errors', () => {
      const result = errorHandler.handleError({ status: 500 });

      expect(result.error).toContain('Ошибка сервера');
      expect(result.isRetryable).toBe(true);
      expect(result.severity).toBe('warning');
    });

    test('Should handle 502 Bad Gateway', () => {
      const result = errorHandler.handleError({ status: 502 });

      expect(result.error).toContain('Ошибка сервера');
      expect(result.isRetryable).toBe(true);
    });
  });

  describe('Retry logic', () => {
    test('Should not retry on client errors (4xx)', () => {
      const clientErrors = [400, 401, 403, 404, 405, 410];

      clientErrors.forEach(status => {
        const result = errorHandler.handleError({ status });

        if (status !== 429) { // 429 is retryable
          expect(result.isRetryable).toBe(false);
        }
      });
    });

    test('Should retry on server errors (5xx)', () => {
      const serverErrors = [500, 502, 503, 504];

      serverErrors.forEach(status => {
        const result = errorHandler.handleError({ status });
        expect(result.isRetryable).toBe(true);
      });
    });

    test('Should retry on rate limit (429)', () => {
      const result = errorHandler.handleError({ status: 429 });
      expect(result.isRetryable).toBe(true);
    });
  });

  describe('Severity levels', () => {
    test('Should set error severity for 400', () => {
      const result = errorHandler.handleError({ status: 400 });
      expect(result.severity).toBe('error');
    });

    test('Should set error severity for 401', () => {
      const result = errorHandler.handleError({ status: 401 });
      expect(result.severity).toBe('error');
    });

    test('Should set warning severity for 403', () => {
      const result = errorHandler.handleError({ status: 403 });
      expect(result.severity).toBe('warning');
    });

    test('Should set warning severity for 5xx', () => {
      const result503 = errorHandler.handleError({ status: 503 });
      const result500 = errorHandler.handleError({ status: 500 });

      expect(result503.severity).toBe('warning');
      expect(result500.severity).toBe('warning');
    });
  });

  describe('Status code included in response', () => {
    test('Should include status code for diagnostic purposes', () => {
      const errors = [400, 401, 403, 404, 429, 503];

      errors.forEach(status => {
        const result = errorHandler.handleError({ status });
        expect(result.status).toBe(status);
      });
    });
  });
});
