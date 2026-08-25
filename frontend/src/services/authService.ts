import axios from 'axios';

import { api } from './api';

export type AppUser = {
  id: string;
  name: string;
  username: string;
  designation: string;
  role: 'ADMIN' | 'USER';
};

export type LoginResponse = {
  token: string;
  user: AppUser;
};

export const getStoredAdmin = (): AppUser | null => {
  const storedAdmin = localStorage.getItem('user');

  if (!storedAdmin) {
    return null;
  }

  try {
    return JSON.parse(storedAdmin) as AppUser;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
};

export const getStoredAdminToken = (): string | null => {
  return localStorage.getItem('authToken');
};

export const clearAdminSession = (): void => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
};

export const login = async (
  username: string,
  password: string,
): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/auth/login', {
    username,
    password,
  });

  return response.data;
};

export const logout = (
  navigate: (path: string, options?: { replace?: boolean }) => void,
): void => {
  clearAdminSession();
  navigate('/', { replace: true });
};

export const isAxiosUnauthorizedError = (error: unknown): boolean => {
  return axios.isAxiosError(error) && error.response?.status === 401;
};
