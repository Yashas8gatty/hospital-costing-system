import { api } from './api';
import type { Doctor } from '../types/doctor';

export type AdminDoctor = Doctor & { active: boolean };

type DoctorResponse = { data: AdminDoctor };
type DoctorsResponse = { data: AdminDoctor[] };

export const getAdminDoctors = async (): Promise<AdminDoctor[]> => {
  const response = await api.get<DoctorsResponse>('/admin/doctors');
  return response.data.data;
};

export const createDoctor = async (name: string, designation: string): Promise<AdminDoctor> => {
  const response = await api.post<DoctorResponse>('/admin/doctors', { name, designation });
  return response.data.data;
};

export const updateDoctor = async (
  id: number,
  data: { name?: string; designation?: string; active?: boolean },
): Promise<AdminDoctor> => {
  const response = await api.put<DoctorResponse>(`/admin/doctors/${id}`, data);
  return response.data.data;
};