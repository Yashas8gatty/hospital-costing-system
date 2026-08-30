ALTER TABLE calculation_records
  ADD COLUMN IF NOT EXISTS patient_gender TEXT CHECK (patient_gender IN ('MALE', 'FEMALE', 'OTHER'));
