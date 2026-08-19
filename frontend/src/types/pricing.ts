export type LimbType = "UNILATERAL" | "BILATERAL";

export type FinancialCategory = 1 | 2 | 3 | 4;

export type TreatmentDuration = 7 | 10 | 14 | 21;

export interface PricingRate {
  id: string;
  limb_type: LimbType;
  duration_days: TreatmentDuration;
  volume_range: string;
  financial_category: FinancialCategory;
  rate: string;
}

export interface AdditionalService {
  id: string;
  service_name: string;
  cost_per_day: string;
  active: boolean;
}

export interface PricingResponse {
  data: PricingRate;
}

export interface AdminPricingUpdateResponse {
  data: PricingRate;
}

export interface ServicesResponse {
  data: AdditionalService[];
}