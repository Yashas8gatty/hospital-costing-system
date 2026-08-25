CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  designation VARCHAR(160) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF to_regclass('public.admins') IS NOT NULL THEN
    INSERT INTO users (id, name, username, password_hash, designation, role)
        SELECT a.id, a.username, a.username, a.password_hash,
          'Administrator', 'ADMIN'
    FROM admins a
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.username = a.username);
  END IF;
END $$;

SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_admin_id_fkey;
ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES users(id);

ALTER TABLE calculation_records
  ADD COLUMN IF NOT EXISTS doctor_name TEXT,
  ADD COLUMN IF NOT EXISTS doctor_designation TEXT,
  ADD COLUMN IF NOT EXISTS signatory_user_id INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS signatory_name TEXT,
  ADD COLUMN IF NOT EXISTS signatory_designation TEXT;

CREATE INDEX IF NOT EXISTS idx_calculation_records_signatory_user_id
  ON calculation_records (signatory_user_id);

ALTER TABLE doctors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE calculation_records cr
SET doctor_name = d.name,
    doctor_designation = d.designation
FROM doctors d
WHERE cr.doctor_id = d.id
  AND (cr.doctor_name IS NULL OR cr.doctor_designation IS NULL);