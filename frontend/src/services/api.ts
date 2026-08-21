import axios from 'axios';

const publicApiPaths = new Set(['/pricing', '/services', '/health', '/auth/login', '/doctors', '/calculations']);

const getNormalizedUrl = (url: string | undefined): string => {
  if (!url) {
    return '';
  }

  if (url.startsWith('http')) {
    return new URL(url).pathname;
  }

  return url;
};

export const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  const requestUrl = getNormalizedUrl(config.url);

  if (token && requestUrl && !publicApiPaths.has(requestUrl)) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const requestUrl = getNormalizedUrl(error.config?.url);

    if (requestUrl && publicApiPaths.has(requestUrl)) {
      return Promise.reject(error);
    }

    localStorage.removeItem('adminToken');
    localStorage.removeItem('admin');

    if (typeof window !== 'undefined') {
      window.location.replace('/admin/login');
    }

    return Promise.reject(error);
  },
);