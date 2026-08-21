import { Request, Response } from "express";
import { pool } from "../config/database";
import { generateCalculationPdf } from "../services/pdfService";

type ServiceSnapshot = {
  service_id: number;
  service_name: string;
  cost_per_day: number;
  duration_days: number;
  total_cost: number;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isServiceSnapshot = (value: unknown): value is ServiceSnapshot => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const service = value as Partial<ServiceSnapshot>;
  const serviceId = service.service_id;
  const costPerDay = service.cost_per_day;
  const durationDays = service.duration_days;
  const totalCost = service.total_cost;

  return (
    typeof serviceId === "number" && Number.isInteger(serviceId) && serviceId > 0 &&
    typeof service.service_name === "string" && service.service_name.trim() !== "" &&
    isFiniteNumber(costPerDay) && costPerDay >= 0 &&
    typeof durationDays === "number" && Number.isInteger(durationDays) && durationDays > 0 &&
    isFiniteNumber(totalCost) && totalCost >= 0 &&
    Math.abs(totalCost - costPerDay * durationDays) < 0.01
  );
};

export const createCalculation = async (req: Request, res: Response) => {
  try {
    const {
      doctor_id: doctorId,
      patient_name: patientName,
      patient_age: patientAge,
      limb_type: limbType,
      volume,
      duration_days: durationDays,
      financial_category: financialCategory,
      base_rate: baseRate,
      services,
      additional_services_total: additionalServicesTotal,
      total_cost: totalCost,
    } = req.body;

    if (!Number.isInteger(doctorId) || doctorId <= 0) {
      return res.status(400).json({ message: "doctor_id must be a positive integer" });
    }

    if (typeof patientName !== "string" || patientName.trim() === "") {
      return res.status(400).json({ message: "patient_name is required and cannot be empty" });
    }

    if (!Number.isInteger(patientAge) || patientAge < 0 || patientAge > 150) {
      return res.status(400).json({ message: "patient_age must be an integer between 0 and 150" });
    }

    if (limbType !== "UNILATERAL" && limbType !== "BILATERAL") {
      return res.status(400).json({ message: "limb_type is invalid" });
    }

    if (!isFiniteNumber(volume) || volume <= 0) {
      return res.status(400).json({ message: "volume must be greater than 0" });
    }

    if (!Number.isInteger(durationDays) || durationDays <= 0) {
      return res.status(400).json({ message: "duration_days must be a positive integer" });
    }

    if (!Number.isInteger(financialCategory) || financialCategory < 1 || financialCategory > 4) {
      return res.status(400).json({ message: "financial_category must be between 1 and 4" });
    }

    if (!isFiniteNumber(baseRate) || baseRate < 0) {
      return res.status(400).json({ message: "base_rate must be a valid non-negative number" });
    }

    if (!Array.isArray(services) || !services.every(isServiceSnapshot)) {
      return res.status(400).json({ message: "services must contain valid price snapshots" });
    }

    if (services.some((service: ServiceSnapshot) => service.duration_days !== durationDays)) {
      return res.status(400).json({ message: "Service snapshot durations must match duration_days" });
    }

    if (!isFiniteNumber(additionalServicesTotal) || additionalServicesTotal < 0) {
      return res.status(400).json({ message: "additional_services_total is invalid" });
    }

    if (!isFiniteNumber(totalCost) || totalCost < 0) {
      return res.status(400).json({ message: "total_cost is invalid" });
    }

    const calculatedServicesTotal = services.reduce((sum, service) => sum + service.total_cost, 0);
    const calculatedTotal = baseRate + calculatedServicesTotal;

    if (
      Math.abs(additionalServicesTotal - calculatedServicesTotal) >= 0.01 ||
      Math.abs(totalCost - calculatedTotal) >= 0.01
    ) {
      return res.status(400).json({ message: "Calculation totals are inconsistent" });
    }

    const doctorResult = await pool.query(
      `SELECT id FROM doctors WHERE id = $1 AND active = TRUE`,
      [doctorId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json({ message: "Active doctor not found" });
    }

    const result = await pool.query(
      `
      INSERT INTO calculation_records (
        doctor_id, patient_name, patient_age, limb_type, volume,
        duration_days, financial_category, base_rate, services,
        additional_services_total, total_cost, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, 'DRAFT')
      RETURNING id, status
      `,
      [
        doctorId,
        patientName.trim(),
        patientAge,
        limbType,
        volume,
        durationDays,
        financialCategory,
        baseRate,
        JSON.stringify(services),
        calculatedServicesTotal,
        calculatedTotal,
      ]
    );

    return res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error("Calculation creation error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getCalculation = async (req: Request, res: Response) => {
  const calculationId = Number(req.params.id);

  if (!Number.isInteger(calculationId) || calculationId <= 0) {
    return res.status(404).json({ message: "Calculation not found" });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        cr.id, cr.doctor_id, cr.patient_name, cr.patient_age,
        cr.limb_type, cr.volume, cr.duration_days, cr.financial_category,
        cr.base_rate, cr.services, cr.additional_services_total,
        cr.total_cost, cr.status, cr.created_at, cr.updated_at,
        json_build_object(
          'id', d.id,
          'name', d.name,
          'designation', d.designation
        ) AS doctor
      FROM calculation_records cr
      INNER JOIN doctors d ON d.id = cr.doctor_id
      WHERE cr.id = $1
      `,
      [calculationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Calculation not found" });
    }

    return res.status(200).json({ data: result.rows[0] });
  } catch (error) {
    console.error("Calculation lookup error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const finalizeCalculation = async (req: Request, res: Response) => {
  const calculationId = Number(req.params.id);

  if (!Number.isInteger(calculationId) || calculationId <= 0) {
    return res.status(404).json({ message: "Calculation not found" });
  }

  try {
    const existingResult = await pool.query(
      `SELECT id, status FROM calculation_records WHERE id = $1`,
      [calculationId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ message: "Calculation not found" });
    }

    if (existingResult.rows[0].status === "FINAL") {
      return res.status(200).json({ data: existingResult.rows[0] });
    }

    const result = await pool.query(
      `
      UPDATE calculation_records
      SET status = 'FINAL', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'DRAFT'
      RETURNING id, status, updated_at
      `,
      [calculationId]
    );

    if (result.rows.length === 0) {
      const currentResult = await pool.query(
        `SELECT id, status FROM calculation_records WHERE id = $1`,
        [calculationId]
      );
      return res.status(200).json({ data: currentResult.rows[0] });
    }

    return res.status(200).json({ data: result.rows[0] });
  } catch (error) {
    console.error("Calculation finalization error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getCalculationPdf = async (req: Request, res: Response) => {
  const calculationId = Number(req.params.id);

  if (!Number.isInteger(calculationId) || calculationId <= 0) {
    return res.status(404).json({ message: "Calculation not found" });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        cr.id, cr.patient_name, cr.patient_age, cr.limb_type, cr.volume,
        cr.duration_days, cr.financial_category, cr.base_rate, cr.services,
        cr.total_cost, cr.status, cr.created_at,
        json_build_object('id', d.id, 'name', d.name, 'designation', d.designation) AS doctor
      FROM calculation_records cr
      INNER JOIN doctors d ON d.id = cr.doctor_id
      WHERE cr.id = $1
      `,
      [calculationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Calculation not found" });
    }

    const calculation = result.rows[0];

    if (calculation.status !== "FINAL") {
      return res.status(409).json({ message: "Calculation is not finalized yet" });
    }

    const pdf = await generateCalculationPdf(calculation);
    const filename = `calculation-report-${String(calculation.id).padStart(6, "0")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(pdf);
  } catch (error) {
    console.error("Calculation PDF generation error:", error);
    return res.status(500).json({ message: "Unable to generate PDF" });
  }
};