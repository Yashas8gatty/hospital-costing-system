import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedAdmin {
  adminId: number;
  username: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  admin?: AuthenticatedAdmin;
}

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Authorization header is required",
      });
    }

    const [scheme, token] = authHeader.split(" ");

    if (!token || scheme !== "Bearer") {
      return res.status(401).json({
        message: "Invalid Authorization header format",
      });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error("JWT_SECRET is not configured");
      return res.status(500).json({
        message: "Internal server error",
      });
    }

    const decoded = jwt.verify(token, secret) as AuthenticatedAdmin;

    req.admin = {
      adminId: decoded.adminId,
      username: decoded.username,
      iat: decoded.iat,
      exp: decoded.exp,
    };

    return next();
  } catch (error) {
    console.error("JWT verification failed:", error);
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};
