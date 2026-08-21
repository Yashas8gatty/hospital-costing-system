import { Request, Response } from "express";
import { pool } from "../config/database";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import { createAuditLog } from "../services/auditService";

export const getDoctors = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `
      SELECT id, name, designation
      FROM doctors
      WHERE active = TRUE
      ORDER BY name ASC
      `
    );

    return res.status(200).json({ data: result.rows });
  } catch (error) {
    console.error("Doctor profile lookup error:", error);
    return res.status(500).json({ message: "Unable to load doctor profiles" });
  }
};

export const getAllDoctors = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      `
      SELECT id, name, designation, active
      FROM doctors
      ORDER BY id ASC
      `
    );

    return res.status(200).json({ data: result.rows });
  } catch (error) {
    console.error("Admin doctor lookup error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createDoctor = async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();

  try {
    const adminId = req.admin?.adminId;
    const { name, designation } = req.body;

    if (!adminId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ message: "name is required and cannot be empty" });
    }

    if (typeof designation !== "string" || designation.trim() === "") {
      return res.status(400).json({ message: "designation is required and cannot be empty" });
    }

    const trimmedName = name.trim();
    const trimmedDesignation = designation.trim();

    await client.query("BEGIN");

    const duplicate = await client.query(
      `SELECT id FROM doctors WHERE name = $1 AND designation = $2`,
      [trimmedName, trimmedDesignation]
    );

    if (duplicate.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Doctor already exists" });
    }

    const result = await client.query(
      `
      INSERT INTO doctors (name, designation, active)
      VALUES ($1, $2, TRUE)
      RETURNING id, name, designation, active
      `,
      [trimmedName, trimmedDesignation]
    );
    const doctor = result.rows[0];

    await createAuditLog(
      {
        adminId,
        action: "CREATE",
        entityType: "DOCTOR",
        entityId: doctor.id,
        recordContext: {
          name: doctor.name,
        },
        oldValue: null,
        newValue: {
          name: doctor.name,
          designation: doctor.designation,
          active: doctor.active,
        },
      },
      client
    );

    await client.query("COMMIT");
    return res.status(201).json({ data: doctor });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Doctor creation error:", error);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

export const updateDoctor = async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();

  try {
    const adminId = req.admin?.adminId;
    const doctorId = Number(req.params.id);
    const { name, designation, active } = req.body;

    if (!adminId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!Number.isInteger(doctorId) || doctorId <= 0) {
      return res.status(400).json({ message: "Doctor id must be a positive integer" });
    }

    if (name === undefined && designation === undefined && active === undefined) {
      return res.status(400).json({ message: "At least one field to update is required" });
    }

    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
      return res.status(400).json({ message: "name must be a non-empty string" });
    }

    if (designation !== undefined && (typeof designation !== "string" || designation.trim() === "")) {
      return res.status(400).json({ message: "designation must be a non-empty string" });
    }

    if (active !== undefined && typeof active !== "boolean") {
      return res.status(400).json({ message: "active must be a boolean" });
    }

    await client.query("BEGIN");

    const existingResult = await client.query(
      `SELECT id, name, designation, active FROM doctors WHERE id = $1 FOR UPDATE`,
      [doctorId]
    );

    if (existingResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Doctor not found" });
    }

    const currentDoctor = existingResult.rows[0];
    const updatedDoctor = {
      name: name !== undefined ? name.trim() : currentDoctor.name,
      designation: designation !== undefined ? designation.trim() : currentDoctor.designation,
      active: active !== undefined ? active : Boolean(currentDoctor.active),
    };
    const oldSnapshot = {
      name: currentDoctor.name,
      designation: currentDoctor.designation,
      active: Boolean(currentDoctor.active),
    };

    if (JSON.stringify(oldSnapshot) === JSON.stringify(updatedDoctor)) {
      await client.query("ROLLBACK");
      return res.status(200).json({ data: { id: doctorId, ...oldSnapshot } });
    }

    const onlyActiveChanged =
      oldSnapshot.name === updatedDoctor.name &&
      oldSnapshot.designation === updatedDoctor.designation &&
      oldSnapshot.active !== updatedDoctor.active;
    const action = onlyActiveChanged ? (updatedDoctor.active ? "ACTIVATE" : "DEACTIVATE") : "UPDATE";

    const result = await client.query(
      `
      UPDATE doctors
      SET name = $1, designation = $2, active = $3
      WHERE id = $4
      RETURNING id, name, designation, active
      `,
      [updatedDoctor.name, updatedDoctor.designation, updatedDoctor.active, doctorId]
    );

    await createAuditLog(
      {
        adminId,
        action,
        entityType: "DOCTOR",
        entityId: doctorId,
        recordContext: {
          name: result.rows[0].name,
        },
        oldValue: onlyActiveChanged ? { active: oldSnapshot.active } : oldSnapshot,
        newValue: onlyActiveChanged ? { active: updatedDoctor.active } : updatedDoctor,
      },
      client
    );

    await client.query("COMMIT");
    return res.status(200).json({ data: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Doctor update error:", error);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};