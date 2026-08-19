import type { PoolClient } from "pg";
import { pool } from "../config/database";

export type AuditAction = "CREATE" | "UPDATE" | "DEACTIVATE" | "ACTIVATE";
export type AuditEntityType = "PRICING" | "SERVICE";

export interface CreateAuditLogInput {
  adminId: number;
  action: AuditAction | string;
  entityType: AuditEntityType | string;
  entityId: number | string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

export const createAuditLog = async (
  {
    adminId,
    action,
    entityType,
    entityId,
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
        old_value,
        new_value
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      adminId,
      action,
      entityType,
      normalizedEntityId,
      oldValue ?? null,
      newValue ?? null,
    ]
  );
};
