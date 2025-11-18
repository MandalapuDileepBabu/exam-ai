import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export interface AuthRequest extends Request {
  user?: any;
}

export const verifyJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "No authorization header" });

  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer")
    return res.status(401).json({ message: "Malformed authorization header" });

  const token = parts[1];

  try {
    const secret = process.env.JWT_SECRET || "change-me";
    const decoded = jwt.verify(token, secret);
    console.log("🔐 verifyJWT: Token verified successfully");
    console.log("Decoded user:", decoded);
    req.user = decoded;
    next();
  } catch (err: any) {
    console.error("❌ JWT verification failed:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

