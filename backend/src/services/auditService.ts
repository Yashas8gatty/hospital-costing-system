import type { PoolClient } from "pg";
import { pool } from "../config/database";

export type AuditAction = "CREATE" | "UPDATE" | "DEACTIVATE" | "ACTIVATE";
export type AuditEntityType = "PRICING" | "SERVICE" | "DOCTOR";

export interface CreateAuditLogInput {
  adminId: number;
  action: AuditAction | string;
  entityType: AuditEntityType | string;
  entityId: number | string;
  recordContext?: Record<string, unknown> | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

export const createAuditLog = async (
  {
    adminId,
    action,
    entityType,
    entityId,
    recordContext,
    oldValue,
    newValue,
  }: CreateAuditLogInput,
  client?: PoolClient
) => {
  const normalizedEntityId = Number(entityId);

  if (!Number.isFinite(normalizedEntityId)) {
    throw new Error("entityId must be a valid number");
  }

  const dbClient = client ?? pool;

  await dbClient.query(
    `
      INSERT INTO audit_logs
      (
        admin_id,
        action,
        entity_type,
        entity_id,
        record_context,
        old_value,
        new_value
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      adminId,
      action,
      entityType,
      normalizedEntityId,
      recordContext ?? null,
      oldValue ?? null,
      newValue ?? null,
    ]
  );
};
