ALTER TABLE calculation_records ADD COLUMN IF NOT EXISTS result_image_path TEXT;
ALTER TABLE calculation_records ADD COLUMN IF NOT EXISTS result_image_original_name TEXT;
ALTER TABLE calculation_records ADD COLUMN IF NOT EXISTS result_image_mime_type TEXT;
ALTER TABLE calculation_records ADD COLUMN IF NOT EXISTS result_image_size INTEGER;
