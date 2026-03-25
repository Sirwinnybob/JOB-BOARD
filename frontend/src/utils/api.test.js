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

describe('authAPI', () => {
  beforeEach(() => {
    // Mock localStorage globally for node environment
    global.localStorage = {
      removeItem: jest.fn(),
      getItem: jest.fn(),
      setItem: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('login should call api.post with correct arguments', async () => {
    const postSpy = jest.spyOn(api, 'post').mockResolvedValue({ data: { token: 'test-token' } });
    const username = 'testuser';
    const password = 'testpassword';

    const result = await authAPI.login(username, password);

    expect(postSpy).toHaveBeenCalledWith('/auth/login', { username, password });
    expect(result.data.token).toBe('test-token');
    postSpy.mockRestore();
  });

  test('login should propagate errors', async () => {
    const error = new Error('Unauthorized');
    const postSpy = jest.spyOn(api, 'post').mockRejectedValue(error);

    await expect(authAPI.login('user', 'pass')).rejects.toThrow('Unauthorized');
    postSpy.mockRestore();
  });

  test('logout should call api.post and clear localStorage', async () => {
    const postSpy = jest.spyOn(api, 'post').mockResolvedValue({});

    await authAPI.logout();

    expect(postSpy).toHaveBeenCalledWith('/auth/logout');
    expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(localStorage.removeItem).toHaveBeenCalledWith('username');
    expect(localStorage.removeItem).toHaveBeenCalledWith('deviceSessionId');
    postSpy.mockRestore();
  });

  test('logout should clear localStorage even if server call fails', async () => {
    const postSpy = jest.spyOn(api, 'post').mockRejectedValue(new Error('Server error'));
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await authAPI.logout();

    expect(postSpy).toHaveBeenCalledWith('/auth/logout');
    expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(localStorage.removeItem).toHaveBeenCalledWith('username');
    expect(localStorage.removeItem).toHaveBeenCalledWith('deviceSessionId');
    consoleSpy.mockRestore();
    postSpy.mockRestore();
  });

  test('clearLocalAuth should clear localStorage', () => {
    authAPI.clearLocalAuth();
    expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(localStorage.removeItem).toHaveBeenCalledWith('username');
    expect(localStorage.removeItem).toHaveBeenCalledWith('deviceSessionId');
  });

  test('isAuthenticated should return true when token exists', () => {
    localStorage.getItem.mockReturnValue('test-token');
    expect(authAPI.isAuthenticated()).toBe(true);
    expect(localStorage.getItem).toHaveBeenCalledWith('token');
  });

  test('isAuthenticated should return false when token does not exist', () => {
    localStorage.getItem.mockReturnValue(null);
    expect(authAPI.isAuthenticated()).toBe(false);
  });

  test('verifyToken should call api.get', async () => {
    const getSpy = jest.spyOn(api, 'get').mockResolvedValue({ data: { valid: true } });

    const result = await authAPI.verifyToken();

    expect(getSpy).toHaveBeenCalledWith('/auth/verify');
    expect(result.data.valid).toBe(true);
    getSpy.mockRestore();
  });
});
