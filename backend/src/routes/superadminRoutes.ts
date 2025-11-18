// src/routes/superadminRoutes.ts
import express, { Request, Response } from "express";
import { verifyJWT } from "../middleware/verifyJWT";
import { requireRole } from "../middleware/requireRole";
import { db } from "../config/firebase";
import { logAction } from "../utils/logger";

const router = express.Router();

// Create an admin account doc (superadmin creates admin user record)
// Note: we expect that actual auth user (firebase auth) for admin is handled separately.
// This endpoint creates the admin Firestore entry and role field.
router.post("/create-admin", verifyJWT, requireRole("superadmin"), async (req: Request, res: Response) => {
  try {
    const { uid, email, fullName } = req.body;
    if (!uid || !email || !fullName) return res.status(400).json({ message: "uid, email, fullName required" });

    const adminDoc = {
      uid,
      email,
      fullName,
      role: "admin",
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    await db.collection("admins").doc(uid).set(adminDoc);
    await db.collection("users").doc(uid).set({ uid, email, fullName, role: "admin", createdAt: new Date().toISOString() }, { merge: true });

    await logAction({
      actorUid: (req as any).user.uid,
      action: "create_admin",
      target: uid,
      details: { email, fullName },
    });

    res.status(201).json({ message: "Admin created", admin: adminDoc });
  } catch (err: any) {
    console.error("create-admin error:", err);
    res.status(500).json({ message: err.message || "Failed to create admin" });
  }
});

// Revoke admin (soft): set role back to "user" and mark isActive false if needed
router.post("/revoke-admin/:uid", verifyJWT, requireRole("superadmin"), async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    const { softDelete = true } = req.body;

    // update admins collection (if exists)
    const adminRef = db.collection("admins").doc(uid);
    const adminSnap = await adminRef.get();

    if (!adminSnap.exists) {
      // still permit revoking user role in users collection
      await db.collection("users").doc(uid).update({ role: "user", isActive: false });
    } else {
      // mark admin as inactive and change role
      await adminRef.update({ role: "user", isActive: false });
      await db.collection("users").doc(uid).update({ role: "user", isActive: false });
    }

    await logAction({
      actorUid: (req as any).user.uid,
      action: "revoke_admin",
      target: uid,
      details: { softDelete },
    });

    res.json({ message: "Admin revoked (soft)", uid });
  } catch (err: any) {
    console.error("revoke-admin error:", err);
    res.status(500).json({ message: err.message || "Failed to revoke admin" });
  }
});

export default router;
