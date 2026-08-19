import { api } from './api';
import type {
  AdminPricingUpdateResponse,
  PricingRate,
} from '../types/pricing';

export type AdminPricingResponse = {
  data: PricingRate[];
};

export const getAdminPricing = async (): Promise<PricingRate[]> => {
  const response = await api.get<AdminPricingResponse>('/admin/pricing');
  return response.data.data;
};

export const updatePricingRate = async (
  id: string,
  rate: number,
): Promise<PricingRate> => {
  const response = await api.put<AdminPricingUpdateResponse>(`/admin/pricing/${id}`, {
    rate,
  });

  return response.data.data;
};
