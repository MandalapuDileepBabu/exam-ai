// src/middleware/requireRole.ts
import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
dotenv.config();

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    // ✅ Automatically treat env superadmin as "superadmin"
    if (user.uid === process.env.SUPERADMIN_UID) {
      user.role = "superadmin";
    }

    const role = user.role || "user"; // fallback

    // ✅ Always allow .env SuperAdmin
    if (role === "superadmin" && user.uid === process.env.SUPERADMIN_UID) {
      return next();
    }

    // ❌ Block if not in allowed roles
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ message: "Forbidden: insufficient privileges" });
    }

    next();
  };
}
