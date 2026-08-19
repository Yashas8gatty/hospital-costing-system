import { Request, Response } from "express";
import { pool } from "../config/database";

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
  req: Request,
  res: Response
) => {
  try {
    const { service_name, cost_per_day } = req.body;

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

    const existingService = await pool.query(
      `
      SELECT id
      FROM additional_services
      WHERE service_name = $1
      `,
      [trimmedName]
    );

    if (existingService.rows.length > 0) {
      return res.status(409).json({
        message: "Service already exists",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO additional_services (service_name, cost_per_day, active)
      VALUES ($1, $2, TRUE)
      RETURNING id, service_name, cost_per_day, active
      `,
      [trimmedName, parsedCostPerDay]
    );

    return res.status(201).json({
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error("Error creating service:", error);

    if (error?.code === "23505") {
      return res.status(409).json({
        message: "Service already exists",
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const updateService = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    const { service_name, cost_per_day, active } = req.body;

    const serviceId = Number(id);

    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      return res.status(400).json({
        message: "Service id must be a positive integer",
      });
    }

    const existingService = await pool.query(
      `
      SELECT id, service_name, cost_per_day, active
      FROM additional_services
      WHERE id = $1
      `,
      [serviceId]
    );

    if (existingService.rows.length === 0) {
      return res.status(404).json({
        message: "Service not found",
      });
    }

    const updatedName =
      service_name !== undefined ? String(service_name).trim() : existingService.rows[0].service_name;
    const updatedCost =
      cost_per_day !== undefined ? Number(cost_per_day) : Number(existingService.rows[0].cost_per_day);
    const updatedActive =
      active !== undefined ? Boolean(active) : Boolean(existingService.rows[0].active);

    if (service_name !== undefined && (typeof service_name !== "string" || updatedName === "")) {
      return res.status(400).json({
        message: "service_name must be a non-empty string",
      });
    }

    if (cost_per_day !== undefined && (typeof cost_per_day !== "number" || Number.isNaN(updatedCost) || updatedCost < 0)) {
      return res.status(400).json({
        message: "cost_per_day must be a valid number greater than or equal to 0",
      });
    }

    if (active !== undefined && typeof active !== "boolean") {
      return res.status(400).json({
        message: "active must be a boolean",
      });
    }

    if (service_name === undefined && cost_per_day === undefined && active === undefined) {
      return res.status(400).json({
        message: "At least one field to update is required",
      });
    }

    const duplicateService = await pool.query(
      `
      SELECT id
      FROM additional_services
      WHERE service_name = $1 AND id <> $2
      `,
      [updatedName, serviceId]
    );

    if (duplicateService.rows.length > 0) {
      return res.status(409).json({
        message: "Service already exists",
      });
    }

    const result = await pool.query(
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

    return res.status(200).json({
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error("Error updating service:", error);

    if (error?.code === "23505") {
      return res.status(409).json({
        message: "Service already exists",
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
