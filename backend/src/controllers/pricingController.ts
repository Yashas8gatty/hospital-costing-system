import { Request, Response } from "express";
import { pool } from "../config/database";

export const getPricing = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      limbType,
      volume,
      duration,
      financialCategory,
    } = req.query;

    if (
      !limbType ||
      !volume ||
      !duration ||
      !financialCategory
    ) {
      return res.status(400).json({
        message:
          "limbType, volume, duration and financialCategory are required",
      });
    }

    const volumeValue = Number(volume);
    const durationValue = Number(duration);
    const categoryValue = Number(financialCategory);

    if (Number.isNaN(volumeValue)) {
      return res.status(400).json({
        message: "Volume must be a valid number",
      });
    }

    if (![7, 10, 14, 21].includes(durationValue)) {
      return res.status(400).json({
        message: "Duration must be 7, 10, 14 or 21 days",
      });
    }

    if (![1, 2, 3, 4].includes(categoryValue)) {
      return res.status(400).json({
        message: "Financial category must be 1, 2, 3 or 4",
      });
    }

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
      WHERE limb_type = $1
        AND duration_days = $2
        AND volume_range @> $3::numeric
        AND financial_category = $4
      `,
      [
        String(limbType).toUpperCase(),
        durationValue,
        volumeValue,
        categoryValue,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "No pricing rate found for the given criteria",
      });
    }

    return res.status(200).json({
      data: result.rows[0],
    });

  } catch (error) {
    console.error("Pricing lookup error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};