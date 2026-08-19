import { Request, Response } from "express";
import { pool } from "../config/database";

export const getActiveServices = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `
      SELECT id, service_name, cost_per_day, active
      FROM additional_services
      WHERE active = TRUE
      ORDER BY id
      `
    );

    return res.status(200).json({
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching active services:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
