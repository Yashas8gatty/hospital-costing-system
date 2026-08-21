ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS record_context JSONB;
