import { Request, Response } from "express";
import { pool } from "../config/database";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import { createAuditLog } from "../services/auditService";

export const getAllPricing = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        limb_type,
        duration_days,
        volume_range,
        financial_category,
        rate
      FROM pricing_rates
      ORDER BY limb_type ASC, duration_days ASC, id ASC
      `
    );

    return res.status(200).json({
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching all pricing records:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const updatePricingRate = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { rate } = req.body;
    const adminId = req.admin?.adminId;

    if (!adminId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (!id) {
      return res.status(400).json({
        message: "Pricing record id is required",
      });
    }

    const pricingId = Number(id);

    if (!Number.isInteger(pricingId) || pricingId <= 0) {
      return res.status(400).json({
        message: "Pricing record id must be a positive integer",
      });
    }

    if (typeof rate !== "number" || Number.isNaN(rate) || rate < 0) {
      return res.status(400).json({
        message: "Rate must be a valid number greater than or equal to 0",
      });
    }

    await client.query("BEGIN");

    const existingResult = await client.query(
      `
      SELECT
        id,
        limb_type,
        volume_range,
        duration_days,
        financial_category,
        rate
      FROM pricing_rates
      WHERE id = $1
      FOR UPDATE
      `,
      [pricingId]
    );

    if (existingResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Pricing record not found",
      });
    }

    const previousRate = Number(existingResult.rows[0].rate);

    if (previousRate === rate) {
      await client.query("ROLLBACK");
      return res.status(200).json({
        data: existingResult.rows[0],
      });
    }

    const result = await client.query(
      `
      UPDATE pricing_rates
      SET rate = $1
      WHERE id = $2
      RETURNING
        id,
        limb_type,
        duration_days,
        volume_range,
        financial_category,
        rate
      `,
      [rate, pricingId]
    );

    await createAuditLog(
      {
        adminId,
        action: "UPDATE",
        entityType: "PRICING",
        entityId: pricingId,
        recordContext: {
          limb_type: result.rows[0].limb_type,
          volume_range: String(result.rows[0].volume_range),
          duration_days: result.rows[0].duration_days,
          financial_category: result.rows[0].financial_category,
        },
        oldValue: {
          rate: String(previousRate),
        },
        newValue: {
          rate: String(result.rows[0].rate),
        },
      },
      client
    );

    await client.query("COMMIT");

    return res.status(200).json({
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating pricing rate:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  } finally {
    client.release();
  }
};
