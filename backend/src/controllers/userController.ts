import { Response } from "express";
import bcrypt from "bcrypt";
import { pool } from "../config/database";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import { createAuditLog } from "../services/auditService";

export const getUsers = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(`SELECT id, name, username, designation, role, active, created_at, updated_at FROM users ORDER BY id ASC`);
    return res.json({ data: result.rows });
  } catch (error) {
    console.error("User lookup error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createUser = async (req: AuthenticatedRequest, res: Response) => {
  const { name, username, designation, password, role = "USER", active = true } = req.body;
  if ([name, username, designation, password].some((value) => typeof value !== "string" || value.trim() === "")) {
    return res.status(400).json({ message: "name, username, designation, and password are required" });
  }
  if (role !== "ADMIN" && role !== "USER") return res.status(400).json({ message: "role is invalid" });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (name, username, password_hash, designation, role, active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, username, designation, role, active`,
      [name.trim(), username.trim(), passwordHash, designation.trim(), role, active === true],
    );
    await createAuditLog({ adminId: req.user!.userId, action: "CREATE", entityType: "USER", entityId: result.rows[0].id, recordContext: { name: result.rows[0].name }, newValue: result.rows[0] });
    return res.status(201).json({ data: result.rows[0] });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "23505") return res.status(409).json({ message: "Username already exists" });
    console.error("User creation error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response) => {
  const userId = Number(req.params.id);
  const { name, username, designation, password, role, active } = req.body;
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ message: "User id must be positive" });
  if (role !== undefined && role !== "ADMIN" && role !== "USER") return res.status(400).json({ message: "role is invalid" });
  try {
    const current = await pool.query(`SELECT id, name, username, designation, role, active FROM users WHERE id = $1`, [userId]);
    if (!current.rows.length) return res.status(404).json({ message: "User not found" });
    const fields = {
      name: name === undefined ? current.rows[0].name : String(name).trim(),
      username: username === undefined ? current.rows[0].username : String(username).trim(),
      designation: designation === undefined ? current.rows[0].designation : String(designation).trim(),
      role: role === undefined ? current.rows[0].role : role,
      active: active === undefined ? current.rows[0].active : active,
    };
    if (!fields.name || !fields.username || !fields.designation || typeof fields.active !== "boolean") return res.status(400).json({ message: "Invalid user fields" });
    const passwordHash = password ? await bcrypt.hash(String(password), 12) : null;
    const result = await pool.query(
      `UPDATE users SET name = $1, username = $2, designation = $3, role = $4, active = $5, password_hash = COALESCE($6, password_hash), updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING id, name, username, designation, role, active`,
      [fields.name, fields.username, fields.designation, fields.role, fields.active, passwordHash, userId],
    );
    await createAuditLog({ adminId: req.user!.userId, action: "UPDATE", entityType: "USER", entityId: userId, recordContext: { name: result.rows[0].name }, oldValue: current.rows[0], newValue: result.rows[0] });
    return res.json({ data: result.rows[0] });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "23505") return res.status(409).json({ message: "Username already exists" });
    console.error("User update error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
