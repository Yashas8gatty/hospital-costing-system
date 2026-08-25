ALTER TABLE calculation_records
  ADD COLUMN IF NOT EXISTS left_volume NUMERIC,
  ADD COLUMN IF NOT EXISTS right_volume NUMERIC,
  ADD COLUMN IF NOT EXISTS girth_measurements JSONB;
