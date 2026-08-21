CREATE TABLE IF NOT EXISTS calculation_records (
  id BIGSERIAL PRIMARY KEY,
  doctor_id BIGINT NOT NULL REFERENCES doctors(id),
  patient_name TEXT NOT NULL,
  patient_age INTEGER NOT NULL CHECK (patient_age BETWEEN 0 AND 150),
  limb_type TEXT NOT NULL,
  volume NUMERIC NOT NULL,
  duration_days INTEGER NOT NULL,
  financial_category INTEGER NOT NULL,
  base_rate NUMERIC(12, 2) NOT NULL,
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  additional_services_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINAL')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calculation_records_doctor_id
  ON calculation_records (doctor_id);
