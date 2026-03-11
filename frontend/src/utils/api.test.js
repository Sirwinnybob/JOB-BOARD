import api, { authAPI } from './api';
import { jest } from '@jest/globals';

describe('API Interceptor', () => {
  let onRejected;
  let onUnauthorizedMock;

  beforeEach(() => {
    // Get the response interceptor rejection handler
    // In axios, handlers is an array of objects { fulfilled, rejected }
    onRejected = api.interceptors.response.handlers[0].rejected;

    // Mock localStorage globally for node environment
    global.localStorage = {
      removeItem: jest.fn(),
      getItem: jest.fn(),
      setItem: jest.fn(),
    };

    onUnauthorizedMock = jest.fn();
    authAPI.onUnauthorized(onUnauthorizedMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should pass through successful responses', async () => {
    const onFulfilled = api.interceptors.response.handlers[0].fulfilled;
    const response = { status: 200, data: { success: true } };

    const result = await onFulfilled(response);
    expect(result).toBe(response);
  });

  test('should handle 401 error on regular endpoint', async () => {
    const error = {
      response: { status: 401 },
      config: { url: '/api/pdfs' }
    };

    try {
      await onRejected(error);
    } catch (e) {
      expect(e).toBe(error);
    }

    expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(localStorage.removeItem).toHaveBeenCalledWith('username');
    expect(localStorage.removeItem).toHaveBeenCalledWith('deviceSessionId');
    expect(onUnauthorizedMock).toHaveBeenCalledWith(
      'Your session has expired or you have been logged out. Please log in again.'
    );
  });

  test('should NOT handle 401 error on logout endpoint', async () => {
    const error = {
      response: { status: 401 },
      config: { url: '/api/auth/logout' }
    };

    try {
      await onRejected(error);
    } catch (e) {
      expect(e).toBe(error);
    }

    expect(localStorage.removeItem).not.toHaveBeenCalled();
    expect(onUnauthorizedMock).not.toHaveBeenCalled();
  });

  test('should NOT handle non-401 errors', async () => {
    const error = {
      response: { status: 403 },
      config: { url: '/api/pdfs' }
    };

    try {
      await onRejected(error);
    } catch (e) {
      expect(e).toBe(error);
    }

    expect(localStorage.removeItem).not.toHaveBeenCalled();
    expect(onUnauthorizedMock).not.toHaveBeenCalled();
  });

  test('should handle error without response object', async () => {
    const error = new Error('Network Error');

    try {
      await onRejected(error);
    } catch (e) {
      expect(e).toBe(error);
    }

    expect(localStorage.removeItem).not.toHaveBeenCalled();
    expect(onUnauthorizedMock).not.toHaveBeenCalled();
  });
});
