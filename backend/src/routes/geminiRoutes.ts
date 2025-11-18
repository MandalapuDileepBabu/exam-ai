// src/routes/geminiRoutes.ts
import express from "express";
import { generateGeminiResponse } from "../services/geminiService";
import { verifyJWT } from "../middleware/verifyJWT";

const router = express.Router();

// simple generate endpoint (no auth)
router.post("/generate", async (req, res) => {
  try {
    const { prompt, model } = req.body;
    if (!prompt) return res.status(400).json({ ok: false, message: "Prompt required" });

    const text = await generateGeminiResponse(prompt, { model });
    return res.json({ ok: true, text });
  } catch (err: any) {
    console.error("POST /generate error:", err);
    return res.status(500).json({ ok: false, message: err?.message ?? "Failed" });
  }
});

// chat endpoint that requires auth and logs session
router.post("/chat", verifyJWT, async (req, res) => {
  try {
    const user = (req as any).user;
    const { prompt, sessionId, model } = req.body;
    if (!prompt) return res.status(400).json({ ok: false, message: "Prompt required" });

    const text = await generateGeminiResponse(prompt, { model, sessionId, userUid: user.uid });
    return res.json({ ok: true, text, sessionId: sessionId ?? null });
  } catch (err: any) {
    console.error("POST /chat error:", err);
    return res.status(500).json({ ok: false, message: err?.message ?? "Failed" });
  }
});

export default router;
