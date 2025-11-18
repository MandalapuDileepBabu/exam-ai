// src/routes/historyRoutes.ts
import express from "express";
import { verifyJWT } from "../middleware/verifyJWT";
import { db } from "../config/firebase";
import { getDriveClient, readJsonFileSafe } from "../services/driveService";

const router = express.Router();

/* ==========================================================
   📌 GET /api/history/mentor
========================================================== */
router.get("/mentor", verifyJWT, async (req, res) => {
  try {
    const user = (req as any).user;

    const snap = await db
      .collection("users")
      .doc(user.uid)
      .collection("mentor_sessions")
      .orderBy("createdAt", "desc")
      .get();

    const sessions = snap.docs.map((doc) => ({
      id: doc.id,
      title: doc.data().fileName || "Mentor Session",
      createdAt: doc.data().createdAt || "",
    }));

    return res.json({ ok: true, sessions });
  } catch (err) {
    console.error("❌ mentor history error:", err);
    return res.status(500).json({ ok: false, sessions: [] });
  }
});

/* ==========================================================
   📌 GET /api/history/subject
========================================================== */
router.get("/subject", verifyJWT, async (req, res) => {
  try {
    const user = (req as any).user;

    const snap = await db
      .collection("users")
      .doc(user.uid)
      .collection("study_sessions")
      .orderBy("createdAt", "desc")
      .get();

    const sessions = snap.docs.map((doc) => ({
      id: doc.id,
      title: doc.data().fileName || "Study Session",
      createdAt: doc.data().createdAt || "",
    }));

    return res.json({ ok: true, sessions });
  } catch (err) {
    console.error("❌ study history error:", err);
    return res.status(500).json({ ok: false, sessions: [] });
  }
});

/* ==========================================================
   📌 GET /api/history/mentor/session/:id
========================================================== */
router.get("/mentor/session/:id", verifyJWT, async (req, res) => {
  try {
    const drive = await getDriveClient();
    const json = await readJsonFileSafe(drive, req.params.id);

    return res.json({
      ok: true,
      session: {
        id: req.params.id,
        createdAt: json.createdAt || "",
        messages: json.messages || [],
      },
    });
  } catch (err) {
    console.error("❌ mentor session load error:", err);
    return res.json({ ok: false, session: null });
  }
});

/* ==========================================================
   📌 GET /api/history/subject/session/:id
========================================================== */
router.get("/subject/session/:id", verifyJWT, async (req, res) => {
  try {
    const drive = await getDriveClient();
    const json = await readJsonFileSafe(drive, req.params.id);

    return res.json({
      ok: true,
      session: {
        id: req.params.id,
        createdAt: json.createdAt || "",
        messages: json.messages || [],
      },
    });
  } catch (err) {
    console.error("❌ subject session load error:", err);
    return res.json({ ok: false, session: null });
  }
});

export default router;
