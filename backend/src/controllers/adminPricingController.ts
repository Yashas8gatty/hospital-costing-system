import { Request, Response } from "express";
import { pool } from "../config/database";

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
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    const { rate } = req.body;

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

    const existingResult = await pool.query(
      `
      SELECT id
      FROM pricing_rates
      WHERE id = $1
      `,
      [pricingId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        message: "Pricing record not found",
      });
    }

    const result = await pool.query(
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

    return res.status(200).json({
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating pricing rate:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
