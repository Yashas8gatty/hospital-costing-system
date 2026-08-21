import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const AUDIT_LOG_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES admins(id),
    action VARCHAR(32) NOT NULL,
    entity_type VARCHAR(32) NOT NULL,
    entity_id INTEGER NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs (created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_audit_logs_filters
    ON audit_logs (entity_type, action, admin_id, created_at DESC);
`;

const DOCTORS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS doctors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    designation VARCHAR(160) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;

const CALCULATION_RECORDS_TABLE_SQL = `
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
`;

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

export const ensureAuditTable = async (): Promise<void> => {
  await pool.query(AUDIT_LOG_TABLE_SQL);
  await pool.query(
    `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS record_context JSONB`
  );
};

export const ensureDoctorsTable = async (): Promise<void> => {
  await pool.query(DOCTORS_TABLE_SQL);
  await pool.query(
    `
    UPDATE doctors
    SET active = TRUE
    WHERE (name, designation) IN (
      ('Dr S R Narahari', 'MD, DVD (Modern Dermatology)'),
      ('Dr. K.S. Prasanna', 'Chief Consultant Dermatologist'),
      ('Dr. Guruprasad Aggithaya', 'Chief Ayurveda Consultant'),
      ('Dr. Pallavi', 'Ayurveda Consultant'),
      ('Dr. Sidharth Vijayan', 'Jr. Ayurveda Consultant'),
      ('Dr Dev Prasad', 'Jr. Ayurveda Consultant'),
      ('Dr. Arunachalam.A', 'Jr. Ayurveda Consultant')
    )
    `
  );
  await pool.query(
    `
    INSERT INTO doctors (name, designation)
    SELECT seed.name, seed.designation
    FROM (VALUES
      ('Dr S R Narahari', 'MD, DVD (Modern Dermatology)'),
      ('Dr. K.S. Prasanna', 'Chief Consultant Dermatologist'),
      ('Dr. Guruprasad Aggithaya', 'Chief Ayurveda Consultant'),
      ('Dr. Pallavi', 'Ayurveda Consultant'),
      ('Dr. Sidharth Vijayan', 'Jr. Ayurveda Consultant'),
      ('Dr Dev Prasad', 'Jr. Ayurveda Consultant'),
      ('Dr. Arunachalam.A', 'Jr. Ayurveda Consultant')
    ) AS seed(name, designation)
    WHERE NOT EXISTS (
      SELECT 1
      FROM doctors
      WHERE doctors.name = seed.name
        AND doctors.designation = seed.designation
    )
    `
  );
};

export const ensureCalculationRecordsTable = async (): Promise<void> => {
  await pool.query(CALCULATION_RECORDS_TABLE_SQL);
};

pool.on("connect", () => {
  console.log("PostgreSQL connected");
});

pool.on("error", (error) => {
  console.error("PostgreSQL connection error:", error);
});