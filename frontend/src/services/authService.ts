import axios from 'axios';

import { api } from './api';

export type AdminUser = {
  id: string;
  username: string;
};

export type LoginResponse = {
  token: string;
  admin: AdminUser;
};

export const getStoredAdmin = (): AdminUser | null => {
  const storedAdmin = localStorage.getItem('admin');

  if (!storedAdmin) {
    return null;
  }

  try {
    return JSON.parse(storedAdmin) as AdminUser;
  } catch {
    localStorage.removeItem('admin');
    return null;
  }
};

export const getStoredAdminToken = (): string | null => {
  return localStorage.getItem('adminToken');
};

export const clearAdminSession = (): void => {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('admin');
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
  navigate('/admin/login', { replace: true });
};

export const isAxiosUnauthorizedError = (error: unknown): boolean => {
  return axios.isAxiosError(error) && error.response?.status === 401;
};
