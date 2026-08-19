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

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

export const ensureAuditTable = async (): Promise<void> => {
  await pool.query(AUDIT_LOG_TABLE_SQL);
};

pool.on("connect", () => {
  console.log("PostgreSQL connected");
});

pool.on("error", (error) => {
  console.error("PostgreSQL connection error:", error);
});