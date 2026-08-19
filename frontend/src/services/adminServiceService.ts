import { api } from './api';
import type { AdditionalService } from '../types/pricing';

export type AdminServicesResponse = {
  data: AdditionalService[];
};

export type AdminServiceResponse = {
  data: AdditionalService;
};

export const getAdminServices = async (): Promise<AdditionalService[]> => {
  const response = await api.get<AdminServicesResponse>('/admin/services');
  return response.data.data;
};

export const createService = async (
  service_name: string,
  cost_per_day: number,
): Promise<AdditionalService> => {
  const response = await api.post<AdminServiceResponse>('/admin/services', {
    service_name,
    cost_per_day,
  });

  return response.data.data;
};

export const updateService = async (
  id: string,
  data: {
    service_name?: string;
    cost_per_day?: number;
    active?: boolean;
  },
): Promise<AdditionalService> => {
  const response = await api.put<AdminServiceResponse>(`/admin/services/${id}`, data);
  return response.data.data;
};
