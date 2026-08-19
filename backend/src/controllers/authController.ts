import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/database";

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required",
      });
    }

    const adminResult = await pool.query(
      `
      SELECT id, username, password_hash
      FROM admins
      WHERE username = $1
      `,
      [username]
    );

    if (adminResult.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    const admin = adminResult.rows[0];
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error("JWT_SECRET is not configured");
      return res.status(500).json({
        message: "Internal server error",
      });
    }

    const token = jwt.sign(
      {
        adminId: admin.id,
        username: admin.username,
      },
      secret,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
