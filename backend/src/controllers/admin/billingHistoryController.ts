import { Response } from "express";
import { pool } from "../../config/database";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware";

export const getBillingHistory = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    // Return all records for client-side filtering/pagination
    // consistent with the rest of the Admin configurations (e.g. AuditLogs, PricingManagement).
    const result = await pool.query(
      `
      SELECT
        cr.id,
        cr.patient_name,
        cr.patient_age,
        cr.patient_gender,
        cr.limb_type,
        cr.volume,
        cr.duration_days,
        cr.financial_category,
        cr.total_cost,
        cr.status,
        cr.created_at,
        json_build_object(
          'id', u.id,
          'name', COALESCE(cr.signatory_name, u.name, 'Signatory unavailable'),
          'designation', COALESCE(cr.signatory_designation, u.designation, '')
        ) AS biller,
        json_build_object(
          'id', d.id,
          'name', COALESCE(cr.doctor_name, d.name),
          'designation', COALESCE(cr.doctor_designation, d.designation)
        ) AS doctor
      FROM calculation_records cr
      INNER JOIN doctors d ON d.id = cr.doctor_id
      LEFT JOIN users u ON u.id = cr.signatory_user_id
      ORDER BY cr.created_at DESC
      `
    );

    return res.status(200).json({
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching billing history:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
