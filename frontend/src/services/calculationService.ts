import { api } from './api';

export type CalculationServiceSnapshot = {
  service_id: number;
  service_name: string;
  cost_per_day: number;
  duration_days: number;
  total_cost: number;
};

export type CreateCalculationPayload = {
  doctor_id: number;
  patient_name: string;
  patient_age: number;
  limb_type: 'UNILATERAL' | 'BILATERAL';
  volume: number;
  duration_days: number;
  financial_category: number;
  base_rate: number;
  services: CalculationServiceSnapshot[];
  additional_services_total: number;
  total_cost: number;
};

export type CreatedCalculation = {
  id: string;
  status: 'DRAFT' | 'FINAL';
};

export type FinalizedCalculation = {
  id: string;
  status: 'FINAL';
  updated_at?: string;
};

export type ReportDoctor = {
  id: string;
  name: string;
  designation: string;
};

export type CalculationReport = {
  id: string;
  doctor_id: string;
  patient_name: string;
  patient_age: number;
  limb_type: 'UNILATERAL' | 'BILATERAL';
  volume: string;
  duration_days: number;
  financial_category: number;
  base_rate: string;
  services: CalculationServiceSnapshot[];
  additional_services_total: string;
  total_cost: string;
  status: 'DRAFT' | 'FINAL';
  created_at: string;
  updated_at: string;
  doctor: ReportDoctor;
};

type CalculationResponse = {
  data: CreatedCalculation;
};

type CalculationReportResponse = {
  data: CalculationReport;
};

type FinalizedCalculationResponse = {
  data: FinalizedCalculation;
};

export const createCalculation = async (
  payload: CreateCalculationPayload,
): Promise<CreatedCalculation> => {
  const response = await api.post<CalculationResponse>('/calculations', payload);
  return response.data.data;
};

export const getCalculation = async (id: string): Promise<CalculationReport> => {
  const response = await api.get<CalculationReportResponse>(`/calculations/${id}`);
  return response.data.data;
};

export const finalizeCalculation = async (id: string): Promise<FinalizedCalculation> => {
  const response = await api.put<FinalizedCalculationResponse>(`/calculations/${id}/finalize`);
  return response.data.data;
};

export const getCalculationPdf = async (id: string): Promise<Blob> => {
  const response = await api.get<Blob>(`/calculations/${id}/pdf`, {
    responseType: 'blob',
  });
  return response.data;
};