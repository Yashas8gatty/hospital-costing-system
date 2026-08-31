import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { pool } from "../config/database";
import { generateCalculationPdf } from "../services/pdfService";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

type ServiceSnapshot = {
  service_id: number;
  service_name: string;
  cost_per_day: number;
  duration_days: number;
  total_cost: number;
};

type GirthMeasurement = {
  left: number;
  right: number;
};

type GirthMeasurements = Record<string, GirthMeasurement>;

const GIRTH_SITES = [
  "maximum_bulk_calf_standing",
  "mid_thigh",
  "patellar_region",
  "maximum_bulk",
  "end_of_calf_muscle_bulk",
  "ankle",
  "midfoot",
  "metatarsal",
] as const;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isGirthMeasurements = (value: unknown): value is GirthMeasurements => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const measurements = value as Record<string, unknown>;
  return GIRTH_SITES.every((site) => {
    const measurement = measurements[site];
    if (!measurement || typeof measurement !== "object") {
      return false;
    }

    const values = measurement as Record<string, unknown>;
    return (
      isFiniteNumber(values.left) && values.left > 0 &&
      isFiniteNumber(values.right) && values.right > 0
    );
  });
};

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

export const createCalculation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const signatoryUserId = req.user?.userId;
    if (!signatoryUserId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const {
      doctor_id: doctorId,
      patient_name: patientName,
      patient_age: patientAge,
      patient_gender: patientGender,
      limb_type: limbType,
      volume,
      left_volume: leftVolume,
      right_volume: rightVolume,
      girth_measurements: girthMeasurements,
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

    const normalizedGender = typeof patientGender === "string" ? patientGender.toUpperCase().trim() : "";
    if (normalizedGender !== "MALE" && normalizedGender !== "FEMALE" && normalizedGender !== "OTHER") {
      return res.status(400).json({ message: "patient_gender is required and must be MALE, FEMALE, or OTHER" });
    }

    if (limbType !== "UNILATERAL" && limbType !== "BILATERAL") {
      return res.status(400).json({ message: "limb_type is invalid" });
    }

    if (!isFiniteNumber(volume) || volume <= 0) {
      return res.status(400).json({ message: "volume must be greater than 0" });
    }

    if (!isFiniteNumber(leftVolume) || leftVolume <= 0 || !isFiniteNumber(rightVolume) || rightVolume <= 0) {
      return res.status(400).json({ message: "left_volume and right_volume must be greater than 0" });
    }

    const expectedBillingVolume = limbType === "UNILATERAL"
      ? Math.max(leftVolume, rightVolume)
      : leftVolume + rightVolume;
    if (Math.abs(volume - expectedBillingVolume) >= 0.000001) {
      return res.status(400).json({ message: "volume must match the derived billing volume" });
    }

    if (!isGirthMeasurements(girthMeasurements)) {
      return res.status(400).json({ message: "girth_measurements must contain all required measurements" });
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
      `SELECT id, name, designation FROM doctors WHERE id = $1 AND active = TRUE`,
      [doctorId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json({ message: "Active doctor not found" });
    }

    const signatoryResult = await pool.query(
      `SELECT id, name, designation FROM users WHERE id = $1 AND active = TRUE`,
      [signatoryUserId],
    );
    if (signatoryResult.rows.length === 0) {
      return res.status(401).json({ message: "Authenticated user is inactive" });
    }
    const signatory = signatoryResult.rows[0];
    const doctor = doctorResult.rows[0];

    const result = await pool.query(
      `
      INSERT INTO calculation_records (
        doctor_id, doctor_name, doctor_designation, signatory_user_id, signatory_name, signatory_designation,
        patient_name, patient_age, patient_gender, limb_type, volume, left_volume, right_volume, girth_measurements,
        duration_days, financial_category, base_rate, services,
        additional_services_total, total_cost, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19, $20, 'DRAFT')
      RETURNING id, status
      `,
      [
        doctorId,
        doctor.name,
        doctor.designation,
        signatory.id,
        signatory.name,
        signatory.designation,
        patientName.trim(),
        patientAge,
        normalizedGender,
        limbType,
        volume,
        leftVolume,
        rightVolume,
        JSON.stringify(girthMeasurements),
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
        cr.id, cr.doctor_id, cr.signatory_user_id, cr.signatory_name, cr.signatory_designation, cr.patient_name, cr.patient_age, cr.patient_gender,
        cr.limb_type, cr.volume, cr.left_volume, cr.right_volume, cr.girth_measurements,
        cr.duration_days, cr.financial_category,
        cr.base_rate, cr.services, cr.additional_services_total,
        cr.total_cost, cr.status, cr.created_at, cr.updated_at,
        cr.result_image_path, cr.result_image_original_name, cr.result_image_mime_type, cr.result_image_size,
        json_build_object(
          'id', d.id,
          'name', COALESCE(cr.doctor_name, d.name),
          'designation', COALESCE(cr.doctor_designation, d.designation)
        ) AS doctor,
        json_build_object(
          'id', u.id,
          'name', COALESCE(cr.signatory_name, u.name, 'Signatory unavailable'),
          'designation', COALESCE(cr.signatory_designation, u.designation, '')
        ) AS signatory
      FROM calculation_records cr
      INNER JOIN doctors d ON d.id = cr.doctor_id
      LEFT JOIN users u ON u.id = cr.signatory_user_id
      WHERE cr.id = $1
      `,
      [calculationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Calculation not found" });
    }

    const calculation = result.rows[0];
    const user = (req as AuthenticatedRequest).user;
    if (user && user.role !== "ADMIN" && calculation.signatory_user_id !== user.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    return res.status(200).json({ data: calculation });
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
      `SELECT id, status, signatory_user_id FROM calculation_records WHERE id = $1`,
      [calculationId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ message: "Calculation not found" });
    }

    const calculation = existingResult.rows[0];
    const user = (req as AuthenticatedRequest).user;
    if (user && user.role !== "ADMIN" && calculation.signatory_user_id !== user.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (calculation.status === "FINAL") {
      return res.status(200).json({ data: calculation });
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
        cr.id, cr.signatory_user_id, cr.patient_name, cr.patient_age, cr.patient_gender, cr.limb_type, cr.volume,
        cr.duration_days, cr.financial_category, cr.base_rate, cr.services,
        cr.total_cost, cr.status, cr.created_at,
        cr.result_image_path, cr.result_image_mime_type,
        json_build_object('id', d.id, 'name', COALESCE(cr.doctor_name, d.name), 'designation', COALESCE(cr.doctor_designation, d.designation)) AS doctor
        , json_build_object(
          'id', u.id,
          'name', COALESCE(cr.signatory_name, u.name, 'Signatory unavailable'),
          'designation', COALESCE(cr.signatory_designation, u.designation, '')
        ) AS signatory
      FROM calculation_records cr
      INNER JOIN doctors d ON d.id = cr.doctor_id
      LEFT JOIN users u ON u.id = cr.signatory_user_id
      WHERE cr.id = $1
      `,
      [calculationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Calculation not found" });
    }

    const calculation = result.rows[0];
    const user = (req as AuthenticatedRequest).user;
    if (user && user.role !== "ADMIN" && calculation.signatory_user_id !== user.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (calculation.status !== "FINAL") {
      return res.status(409).json({ message: "Calculation is not finalized yet" });
    }

    let result_image_base64: string | null = null;
    if (calculation.result_image_path) {
      const imgPath = path.join(process.cwd(), calculation.result_image_path);
      if (fs.existsSync(imgPath)) {
        try {
          result_image_base64 = fs.readFileSync(imgPath).toString("base64");
        } catch (readError) {
          console.error("Failed to read image for PDF generation:", readError);
        }
      }
    }

    const pdf = await generateCalculationPdf({
      ...calculation,
      result_image_base64,
      result_image_mime_type: calculation.result_image_mime_type,
    });
    const filename = `calculation-report-${String(calculation.id).padStart(6, "0")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(pdf);
  } catch (error) {
    console.error("Calculation PDF generation error:", error);
    return res.status(500).json({ message: "Unable to generate PDF" });
  }
};

export const uploadResultImage = async (req: Request, res: Response) => {
  const calculationId = Number(req.params.id);
  if (!Number.isInteger(calculationId) || calculationId <= 0) {
    return res.status(404).json({ message: "Calculation not found" });
  }

  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const existingResult = await pool.query(
      `SELECT id, status, signatory_user_id, result_image_path FROM calculation_records WHERE id = $1`,
      [calculationId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ message: "Calculation not found" });
    }

    const calculation = existingResult.rows[0];

    // Only the signatory doctor who created it can modify it
    if (calculation.signatory_user_id !== user.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (calculation.status !== "DRAFT") {
      return res.status(403).json({ message: "Cannot modify finalized calculations" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    // Validate mime type
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: "Invalid file type. Only JPG, PNG, and WEBP are accepted." });
    }

    // Validate size (10 MB = 10 * 1024 * 1024 bytes)
    const maxSize = 10 * 1024 * 1024;
    if (req.file.size > maxSize) {
      return res.status(400).json({ message: "Image must be 10 MB or smaller." });
    }

    // Generate unique name
    const uniqueId = crypto.randomBytes(3).toString("hex");
    let ext = ".jpg";
    if (req.file.mimetype === "image/png") ext = ".png";
    else if (req.file.mimetype === "image/webp") ext = ".webp";
    
    const filename = `result-${uniqueId}${ext}`;
    const paddedId = String(calculationId).padStart(6, "0");
    
    // Directory path
    const uploadDir = path.join(process.cwd(), "uploads", "calculations", paddedId);
    fs.mkdirSync(uploadDir, { recursive: true });
    
    const filePath = path.join(uploadDir, filename);
    const relativePath = path.join("uploads", "calculations", paddedId, filename).replace(/\\/g, "/");

    // Remove old file if it exists to avoid orphans
    if (calculation.result_image_path) {
      const oldPath = path.join(process.cwd(), calculation.result_image_path);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (unlinkError) {
          console.error("Failed to delete old image file:", unlinkError);
        }
      }
    }

    // Write file
    fs.writeFileSync(filePath, req.file.buffer);

    // Save metadata
    await pool.query(
      `
      UPDATE calculation_records
      SET
        result_image_path = $1,
        result_image_original_name = $2,
        result_image_mime_type = $3,
        result_image_size = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      `,
      [relativePath, req.file.originalname, req.file.mimetype, req.file.size, calculationId]
    );

    return res.status(200).json({
      message: "Image uploaded successfully",
      data: {
        result_image_path: relativePath,
        result_image_original_name: req.file.originalname,
        result_image_mime_type: req.file.mimetype,
        result_image_size: req.file.size,
      }
    });

  } catch (error) {
    console.error("Upload image error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const removeResultImage = async (req: Request, res: Response) => {
  const calculationId = Number(req.params.id);
  if (!Number.isInteger(calculationId) || calculationId <= 0) {
    return res.status(404).json({ message: "Calculation not found" });
  }

  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const existingResult = await pool.query(
      `SELECT id, status, signatory_user_id, result_image_path FROM calculation_records WHERE id = $1`,
      [calculationId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ message: "Calculation not found" });
    }

    const calculation = existingResult.rows[0];

    // Only the signatory doctor who created it can modify it
    if (calculation.signatory_user_id !== user.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (calculation.status !== "DRAFT") {
      return res.status(403).json({ message: "Cannot modify finalized calculations" });
    }

    if (calculation.result_image_path) {
      const filePath = path.join(process.cwd(), calculation.result_image_path);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkError) {
          console.error("Failed to delete image file:", unlinkError);
        }
      }
    }

    await pool.query(
      `
      UPDATE calculation_records
      SET
        result_image_path = NULL,
        result_image_original_name = NULL,
        result_image_mime_type = NULL,
        result_image_size = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [calculationId]
    );

    return res.status(200).json({ message: "Image removed successfully" });

  } catch (error) {
    console.error("Remove image error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getResultImage = async (req: Request, res: Response) => {
  const calculationId = Number(req.params.id);
  if (!Number.isInteger(calculationId) || calculationId <= 0) {
    return res.status(404).json({ message: "Calculation not found" });
  }

  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const result = await pool.query(
      `SELECT signatory_user_id, result_image_path, result_image_mime_type FROM calculation_records WHERE id = $1`,
      [calculationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Calculation not found" });
    }

    const calculation = result.rows[0];

    // Authorization check
    if (user.role !== "ADMIN" && calculation.signatory_user_id !== user.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!calculation.result_image_path) {
      return res.status(404).json({ message: "Image not found for this calculation" });
    }

    const filePath = path.join(process.cwd(), calculation.result_image_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Physical image file not found on server" });
    }

    res.setHeader("Content-Type", calculation.result_image_mime_type || "image/jpeg");
    return res.sendFile(filePath);

  } catch (error) {
    console.error("Get image error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};