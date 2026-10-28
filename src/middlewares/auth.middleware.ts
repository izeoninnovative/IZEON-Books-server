/** @format */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthUserPayload {
  id: number;
  email: string;
  role: "ADMIN" | "HR" | "EMPLOYEE";
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

// Middleware to verify JWT Token
export const verifyToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access token is missing or invalid",
    });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token is required",
    });
  }

  const secret = process.env.JWT_SECRET || "izeon_books_secret_jwt_key_2026";

  try {
    const decoded = jwt.verify(token, secret) as AuthUserPayload;
    req.user = decoded;
    return next();
  } catch (_error) {
    return res.status(401).json({
      success: false,
      message: "Token has expired or is invalid",
    });
  }
};

// Middleware to restrict access based on Role (ADMIN / HR)
export const requireRole = (
  allowedRoles: Array<"ADMIN" | "HR" | "EMPLOYEE">,
) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Requires [${allowedRoles.join(", ")}] role access`,
      });
    }

    return next();
  };
};
