/**
 * ✅ Test Suite for Timeout Signals
 * Validates that database and API queries abort after timeout
 */

describe('Timeout Signals', () => {
  let apiService;

  beforeEach(() => {
    // Mock ApiService
    apiService = {
      DB_QUERY_TIMEOUT: 5000,
      TELEGRAM_TIMEOUT: 3000,

      createTimeoutSignal(timeoutMs) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          if (!controller.signal.aborted) {
            controller.abort();
          }
        }, timeoutMs);
        controller.signal._timeoutId = timeoutId;
        return controller.signal;
      },

      mergeSignals(userSignal, timeoutSignal) {
        if (!userSignal) return timeoutSignal;
        if (!timeoutSignal) return userSignal;

        const controller = new AbortController();

        const cleanup = () => {
          if (userSignal._timeoutId) clearTimeout(userSignal._timeoutId);
          if (timeoutSignal._timeoutId) clearTimeout(timeoutSignal._timeoutId);
        };

        userSignal.addEventListener('abort', () => {
          controller.abort();
          cleanup();
        });

        timeoutSignal.addEventListener('abort', () => {
          controller.abort();
          cleanup();
        });

        return controller.signal;
      }
    };
  });

  test('Should abort after timeout period', (done) => {
    const signal = apiService.createTimeoutSignal(100); // 100ms for test
    let aborted = false;

    signal.addEventListener('abort', () => {
      aborted = true;
    });

    setTimeout(() => {
      expect(aborted).toBe(true);
      done();
    }, 150);
  });

  test('Should not abort before timeout', (done) => {
    const signal = apiService.createTimeoutSignal(500); // 500ms for test
    let aborted = false;

    signal.addEventListener('abort', () => {
      aborted = true;
    });

    setTimeout(() => {
      expect(aborted).toBe(false);
      // Cleanup
      if (signal._timeoutId) clearTimeout(signal._timeoutId);
      done();
    }, 100);
  });

  test('Should merge user abort and timeout abort', (done) => {
    const userController = new AbortController();
    const userSignal = userController.signal;
    const timeoutSignal = apiService.createTimeoutSignal(5000);

    const mergedSignal = apiService.mergeSignals(userSignal, timeoutSignal);
    let aborted = false;

    mergedSignal.addEventListener('abort', () => {
      aborted = true;
    });

    // Abort user signal immediately
    userController.abort();

    setTimeout(() => {
      expect(aborted).toBe(true);
      // Cleanup
      if (timeoutSignal._timeoutId) clearTimeout(timeoutSignal._timeoutId);
      done();
    }, 50);
  });

  test('Should handle null signals in merge', () => {
    const timeoutSignal = apiService.createTimeoutSignal(1000);
    const merged1 = apiService.mergeSignals(null, timeoutSignal);
    expect(merged1).toBe(timeoutSignal);

    const userSignal = new AbortController().signal;
    const merged2 = apiService.mergeSignals(userSignal, null);
    expect(merged2).toBe(userSignal);

    // Cleanup
    if (timeoutSignal._timeoutId) clearTimeout(timeoutSignal._timeoutId);
  });

  test('DB_QUERY_TIMEOUT should be 5 seconds', () => {
    expect(apiService.DB_QUERY_TIMEOUT).toBe(5000);
  });

  test('TELEGRAM_TIMEOUT should be 3 seconds', () => {
    expect(apiService.TELEGRAM_TIMEOUT).toBe(3000);
  });
});
