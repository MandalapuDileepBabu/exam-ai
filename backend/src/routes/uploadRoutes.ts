// src/routes/uploadRoutes.ts
import express, { Request, Response } from "express";
import multer from "multer";
import { verifyJWT } from "../middleware/verifyJWT";
import { db } from "../config/firebase";
import { logAction } from "../utils/logger";
import {
  getDriveClient,
  ensureUserDriveStructure,
  uploadBufferToDrive,
} from "../services/driveService";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

/* -------------------------------------------------------------------------- */
/* Generic file upload (/file)                                                 */
/* -------------------------------------------------------------------------- */
router.post(
  "/file",
  verifyJWT,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.uid) return res.status(401).json({ message: "Unauthorized" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const drive = await getDriveClient();
      const folders = await ensureUserDriveStructure(user.uid);

      if (!folders.uploads) {
        return res.status(500).json({ message: "Uploads folder missing" });
      }

      const { url, fileId } = await uploadBufferToDrive(
        drive,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        folders.uploads
      );

      await db.collection("uploads").add({
        ownerUid: user.uid,
        fileId,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url,
        path: `Exam-AI uploads/${user.uid}/uploads`,
        createdAt: new Date().toISOString(),
      });

      await logAction({
        actorUid: user.uid,
        action: "upload_file",
        target: url,
        details: { name: req.file.originalname, url },
      });

      return res.status(200).json({
        success: true,
        message: "✅ File uploaded successfully to Drive",
        url,
        fileId,
      });
    } catch (err: any) {
      console.error("❌ Upload error:", err);
      return res.status(500).json({ message: err?.message ?? "Upload failed" });
    }
  }
);

/* -------------------------------------------------------------------------- */
/* Profile image upload (/profile)                                             */
/* -------------------------------------------------------------------------- */
router.post(
  "/profile",
  verifyJWT,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.uid) return res.status(401).json({ message: "Unauthorized" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const drive = await getDriveClient();
      const folders = await ensureUserDriveStructure(user.uid);

      const profileFolder = folders.profile;
      if (!profileFolder) return res.status(500).json({ message: "Profile folder missing" });

      // delete existing files in profile
      const old = await drive.files.list({
        q: `'${profileFolder}' in parents and trashed=false`,
        fields: "files(id, name)",
        supportsAllDrives: true,
      });
      for (const f of old.data.files || []) {
        if (f.id) await drive.files.delete({ fileId: f.id, supportsAllDrives: true });
      }

      const { url, fileId } = await uploadBufferToDrive(
        drive,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        profileFolder
      );

      await db.collection("users").doc(user.uid).set(
        {
          photoURL: url,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      return res.status(200).json({ success: true, message: "Profile uploaded", url, fileId });
    } catch (err: any) {
      console.error("❌ Profile upload error:", err);
      return res.status(500).json({ message: err?.message ?? "Profile upload failed" });
    }
  }
);

/* -------------------------------------------------------------------------- */
/* Background image upload (/background)                                       */
/* -------------------------------------------------------------------------- */
router.post(
  "/background",
  verifyJWT,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.uid) return res.status(401).json({ message: "Unauthorized" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const drive = await getDriveClient();
      const folders = await ensureUserDriveStructure(user.uid);

      const bgFolder = folders.background;
      if (!bgFolder) return res.status(500).json({ message: "Background folder missing" });

      // delete existing
      const old = await drive.files.list({
        q: `'${bgFolder}' in parents and trashed=false`,
        fields: "files(id, name)",
        supportsAllDrives: true,
      });
      for (const f of old.data.files || []) {
        if (f.id) await drive.files.delete({ fileId: f.id, supportsAllDrives: true });
      }

      const { url, fileId } = await uploadBufferToDrive(
        drive,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        bgFolder
      );

      await db.collection("users").doc(user.uid).set(
        {
          backgroundURL: url,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      return res.status(200).json({ success: true, message: "Background uploaded", url, fileId });
    } catch (err: any) {
      console.error("❌ Background upload error:", err);
      return res.status(500).json({ message: err?.message ?? "Background upload failed" });
    }
  }
);

/* -------------------------------------------------------------------------- */
/* Delete file                                                                 */
/* -------------------------------------------------------------------------- */
router.delete("/file/:fileId", verifyJWT, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { fileId } = req.params;
    if (!user?.uid) return res.status(401).json({ message: "Unauthorized" });
    if (!fileId) return res.status(400).json({ message: "Missing file ID" });

    const drive = await getDriveClient();
    await drive.files.delete({ fileId, supportsAllDrives: true });

    const snapshot = await db
      .collection("uploads")
      .where("fileId", "==", fileId)
      .where("ownerUid", "==", user.uid)
      .get();

    if (!snapshot.empty) {
      const batch = db.batch();
      snapshot.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    await logAction({
      actorUid: user.uid,
      action: "delete_file",
      target: fileId,
      details: { reason: "user_deleted_file" },
    });

    return res.status(200).json({ success: true, message: "File deleted", fileId });
  } catch (err: any) {
    console.error("❌ File delete error:", err);
    return res.status(500).json({ message: err?.message ?? "Failed to delete file" });
  }
});

/* -------------------------------------------------------------------------- */
/* /material endpoint — convenience route for educational materials uploads    */
/* -------------------------------------------------------------------------- */
router.post("/material", verifyJWT, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.uid) return res.status(401).json({ ok: false, message: "Unauthorized" });
    if (!req.file) return res.status(400).json({ ok: false, message: "No file received" });

    const drive = await getDriveClient();
    const folders = await ensureUserDriveStructure(user.uid);

    if (!folders.uploads) return res.status(500).json({ ok: false, message: "Uploads folder missing" });

    const { url, fileId } = await uploadBufferToDrive(
      drive,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      folders.uploads
    );

    await db.collection("uploads").add({
      ownerUid: user.uid,
      url,
      fileId,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      createdAt: new Date().toISOString(),
    });

    return res.json({ ok: true, message: "Uploaded successfully", url, fileId });
  } catch (err: any) {
    console.error("UPLOAD ERROR:", err);
    return res.status(500).json({ ok: false, message: err?.message ?? "Upload failed" });
  }
});

export default router;
