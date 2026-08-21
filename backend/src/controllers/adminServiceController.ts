import { Request, Response } from "express";
import { pool } from "../config/database";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import { createAuditLog } from "../services/auditService";

export const getAllServices = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `
      SELECT id, service_name, cost_per_day, active
      FROM additional_services
      ORDER BY id ASC
      `
    );

    return res.status(200).json({
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching all services:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const createService = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const client = await pool.connect();

  try {
    const { service_name, cost_per_day } = req.body;
    const adminId = req.admin?.adminId;

    if (!adminId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (typeof service_name !== "string" || service_name.trim() === "") {
      return res.status(400).json({
        message: "service_name is required and cannot be empty",
      });
    }

    const parsedCostPerDay = Number(cost_per_day);

    if (typeof cost_per_day !== "number" || Number.isNaN(parsedCostPerDay) || parsedCostPerDay < 0) {
      return res.status(400).json({
        message: "cost_per_day must be a valid number greater than or equal to 0",
      });
    }

    const trimmedName = service_name.trim();

    await client.query("BEGIN");

    const existingService = await client.query(
      `
      SELECT id
      FROM additional_services
      WHERE service_name = $1
      FOR UPDATE
      `,
      [trimmedName]
    );

    if (existingService.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "Service already exists",
      });
    }

    const result = await client.query(
      `
      INSERT INTO additional_services (service_name, cost_per_day, active)
      VALUES ($1, $2, TRUE)
      RETURNING id, service_name, cost_per_day, active
      `,
      [trimmedName, parsedCostPerDay]
    );

    await createAuditLog(
      {
        adminId,
        action: "CREATE",
        entityType: "SERVICE",
        entityId: result.rows[0].id,
        recordContext: {
          service_name: result.rows[0].service_name,
        },
        oldValue: null,
        newValue: {
          service_name: result.rows[0].service_name,
          cost_per_day: String(result.rows[0].cost_per_day),
        },
      },
      client
    );

    await client.query("COMMIT");

    return res.status(201).json({
      data: result.rows[0],
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error creating service:", error);

    if (error?.code === "23505") {
      return res.status(409).json({
        message: "Service already exists",
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  } finally {
    client.release();
  }
};

export const updateService = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { service_name, cost_per_day, active } = req.body;
    const adminId = req.admin?.adminId;

    if (!adminId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const serviceId = Number(id);

    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      return res.status(400).json({
        message: "Service id must be a positive integer",
      });
    }

    await client.query("BEGIN");

    const existingService = await client.query(
      `
      SELECT id, service_name, cost_per_day, active
      FROM additional_services
      WHERE id = $1
      FOR UPDATE
      `,
      [serviceId]
    );

    if (existingService.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Service not found",
      });
    }

    const currentService = existingService.rows[0];

    const updatedName =
      service_name !== undefined ? String(service_name).trim() : currentService.service_name;
    const updatedCost =
      cost_per_day !== undefined ? Number(cost_per_day) : Number(currentService.cost_per_day);
    const updatedActive =
      active !== undefined ? Boolean(active) : Boolean(currentService.active);

    if (service_name !== undefined && (typeof service_name !== "string" || updatedName === "")) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "service_name must be a non-empty string",
      });
    }

    if (cost_per_day !== undefined && (typeof cost_per_day !== "number" || Number.isNaN(updatedCost) || updatedCost < 0)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "cost_per_day must be a valid number greater than or equal to 0",
      });
    }

    if (active !== undefined && typeof active !== "boolean") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "active must be a boolean",
      });
    }

    if (service_name === undefined && cost_per_day === undefined && active === undefined) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "At least one field to update is required",
      });
    }

    const duplicateService = await client.query(
      `
      SELECT id
      FROM additional_services
      WHERE service_name = $1 AND id <> $2
      `,
      [updatedName, serviceId]
    );

    if (duplicateService.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "Service already exists",
      });
    }

    const oldSnapshot = {
      service_name: currentService.service_name,
      cost_per_day: String(currentService.cost_per_day),
      active: Boolean(currentService.active),
    };
    const newSnapshot = {
      service_name: updatedName,
      cost_per_day: String(updatedCost),
      active: updatedActive,
    };

    if (JSON.stringify(oldSnapshot) === JSON.stringify(newSnapshot)) {
      await client.query("ROLLBACK");
      return res.status(200).json({
        data: currentService,
      });
    }

    let action: "UPDATE" | "ACTIVATE" | "DEACTIVATE" = "UPDATE";
    let oldValue: Record<string, unknown> | null = { ...oldSnapshot };
    let newValue: Record<string, unknown> | null = { ...newSnapshot };

    if (
      updatedName === currentService.service_name &&
      Number(updatedCost) === Number(currentService.cost_per_day) &&
      updatedActive !== Boolean(currentService.active)
    ) {
      action = updatedActive ? "ACTIVATE" : "DEACTIVATE";
      oldValue = {
        active: Boolean(currentService.active),
      };
      newValue = {
        active: updatedActive,
      };
    }

    const result = await client.query(
      `
      UPDATE additional_services
      SET service_name = $1,
          cost_per_day = $2,
          active = $3
      WHERE id = $4
      RETURNING id, service_name, cost_per_day, active
      `,
      [updatedName, updatedCost, updatedActive, serviceId]
    );

    await createAuditLog(
      {
        adminId,
        action,
        entityType: "SERVICE",
        entityId: serviceId,
        recordContext: {
          service_name: result.rows[0].service_name,
        },
        oldValue: Object.keys(oldValue).length > 0 ? oldValue : null,
        newValue: Object.keys(newValue).length > 0 ? newValue : null,
      },
      client
    );

    await client.query("COMMIT");

    return res.status(200).json({
      data: result.rows[0],
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error updating service:", error);

    if (error?.code === "23505") {
      return res.status(409).json({
        message: "Service already exists",
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  } finally {
    client.release();
  }
};
