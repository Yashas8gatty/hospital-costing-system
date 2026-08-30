import { api } from '../api';

export type BillingHistoryBiller = {
  id: string | number;
  name: string;
  designation: string;
};

export type BillingHistoryDoctor = {
  id: string | number;
  name: string;
  designation: string;
};

export interface BillingHistoryRecord {
  id: string;
  patient_name: string;
  patient_age: number;
  patient_gender: 'MALE' | 'FEMALE' | 'OTHER';
  biller: BillingHistoryBiller;
  doctor: BillingHistoryDoctor;
  limb_type: 'UNILATERAL' | 'BILATERAL';
  volume: number;
  duration_days: number;
  financial_category: number;
  total_cost: string;
  status: 'DRAFT' | 'FINAL';
  created_at: string;
}

export type BillingHistoryResponse = {
  data: BillingHistoryRecord[];
};

export const getBillingHistory = async (): Promise<BillingHistoryRecord[]> => {
  const response = await api.get<BillingHistoryResponse>('/admin/billing-history');
  return response.data.data;
};
