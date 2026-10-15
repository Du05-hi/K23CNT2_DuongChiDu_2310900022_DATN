import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { store, logout, setCredentials } from '@/store';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Queue để giải quyết tình huống nhiều request đồng thời khi token hết hạn
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request Interceptor: đính kèm Bearer token từ Store hoặc LocalStorage
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const storedToken =
      typeof window !== 'undefined'
        ? localStorage.getItem('accessToken') || localStorage.getItem('token')
        : null;
    const token = storedToken || store.getState().auth.accessToken;
    if (token && config.headers && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response Interceptor: Tự động refresh token khi nhận HTTP 401
apiClient.interceptors.response.use(
  (response) => {
    if ((response.config.url || '').includes('/auth/')) {
      return response;
    }
    const body = response.data;
    if (
      body &&
      typeof body === 'object' &&
      !Array.isArray(body) &&
      'success' in body &&
      'data' in body
    ) {
      response.data = body.data;
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Không xử lý retry nếu lỗi không phải 401 hoặc request đã retry hoặc URL là auth endpoint
    if (!error.response || error.response.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    const requestUrl = originalRequest.url || '';
    if (requestUrl.includes('/auth/login') || requestUrl.includes('/auth/refresh-token')) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) {
      isRefreshing = false;
      processQueue(error, null);
      store.dispatch(logout());
      return Promise.reject(error);
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
        refreshToken,
      });

      const { accessToken, refreshToken: newRefreshToken, user } = response.data.data || response.data;

      if (accessToken) {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('token', accessToken);
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken);
        }
        const currentUser = user || store.getState().auth.user;
        if (currentUser) {
          store.dispatch(setCredentials({ user: currentUser, accessToken, refreshToken: newRefreshToken }));
        }

        processQueue(null, accessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return apiClient(originalRequest);
      } else {
        throw new Error('Refresh token không trả về accessToken');
      }
    } catch (refreshError) {
      processQueue(refreshError, null);
      store.dispatch(logout());
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default apiClient;
