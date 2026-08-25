import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedUser {
  userId: number;
  adminId: number;
  username: string;
  role: "ADMIN" | "USER";
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  admin?: AuthenticatedUser;
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

    const decoded = jwt.verify(token, secret) as AuthenticatedUser;

    req.user = {
      userId: decoded.userId,
      adminId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      iat: decoded.iat,
      exp: decoded.exp,
    };
    req.admin = req.user;

    return next();
  } catch (error) {
    console.error("JWT verification failed:", error);
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ message: "Administrator access required" });
  }

  return next();
};
