import { api } from './api';

export type AdminUser = {
  id: number;
  name: string;
  username: string;
  designation: string;
  role: 'ADMIN' | 'USER';
  active: boolean;
};

type Response<T> = { data: T };
export const getUsers = async (): Promise<AdminUser[]> => (await api.get<Response<AdminUser[]>>('/admin/users')).data.data;
export const createUser = async (data: { name: string; username: string; designation: string; password: string; role: AdminUser['role'] }): Promise<AdminUser> => (await api.post<Response<AdminUser>>('/admin/users', data)).data.data;
export const updateUser = async (id: number, data: Partial<Omit<AdminUser, 'id'>> & { password?: string }): Promise<AdminUser> => (await api.put<Response<AdminUser>>(`/admin/users/${id}`, data)).data.data;
