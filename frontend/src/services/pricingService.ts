import { api } from './api';
import type {
  PricingResponse,
  ServicesResponse,
} from '../types/pricing';

export const getPricing = async (
  limbType: string,
  volume: string,
  duration: number,
  financialCategory: number
) => {
  const response = await api.get<PricingResponse>('/pricing', {
    params: {
      limbType,
      volume,
      duration,
      financialCategory,
    },
  });

  return response.data;
};

export const getAdditionalServices = async () => {
  const response = await api.get<ServicesResponse>('/services');
  return response.data;
};
