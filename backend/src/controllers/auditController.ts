import { Request, Response } from "express";
import { pool } from "../config/database";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

export const getAuditLogs = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { entityType, action, adminId } = req.query;

    const filters: string[] = [];
    const params: Array<string | number> = [];

    if (entityType) {
      params.push(String(entityType).toUpperCase());
      filters.push(`al.entity_type = $${params.length}`);
    }

    if (action) {
      params.push(String(action).toUpperCase());
      filters.push(`al.action = $${params.length}`);
    }

    if (adminId) {
      const parsedAdminId = Number(adminId);
      if (!Number.isInteger(parsedAdminId) || parsedAdminId <= 0) {
        return res.status(400).json({
          message: "adminId must be a positive integer",
        });
      }
      params.push(parsedAdminId);
      filters.push(`al.admin_id = $${params.length}`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const result = await pool.query(
      `
        SELECT
          al.id,
          al.admin_id,
          a.username AS admin_username,
          al.action,
          al.entity_type,
          al.entity_id,
          al.record_context,
          al.old_value,
          al.new_value,
          al.created_at
        FROM audit_logs al
        INNER JOIN admins a ON a.id = al.admin_id
        ${whereClause}
        ORDER BY al.created_at DESC
      `,
      params
    );

    return res.status(200).json({
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
