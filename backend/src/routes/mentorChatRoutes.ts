// src/routes/mentorChatRoutes.ts
import express from "express";
import { verifyJWT } from "../middleware/verifyJWT";
import {
  getDriveClient,
  ensureUserDriveStructure,
  createNewJsonFile,
  appendMessageToJsonFile,
  readJsonFileSafe,
} from "../services/driveService";
import { generateGeminiResponse } from "../services/geminiService";
import { db } from "../config/firebase";

const router = express.Router();

function buildMentorPrompt(userMessage: string) {
  return `
You are a friendly, casual mentor.

Rules:
• Keep messages short (<= 10 lines)
• No long paragraphs
• Match user's vibe
• Never repeat user's message

User: "${userMessage}"

Reply naturally:
  `.trim();
}

function limitLines(text: any, maxLines = 20) {
  return String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, maxLines)
    .join("\n");
}

router.post("/", verifyJWT, async (req, res) => {
  try {
    const { message, sessionId: incomingId } = req.body;
    const user = (req as any).user;

    if (!message) return res.status(400).json({ ok: false, message: "Message required" });

    const drive = await getDriveClient();
    const folders = await ensureUserDriveStructure(user.uid);

    let sessionId = incomingId;
    let history: any[] = [];

    /* ----------------- NEW SESSION ----------------- */
    if (!sessionId) {
      const now = new Date();
      const fileName = `mentor_session_${now.getTime()}.json`;

      const jsonObj = {
        type: "mentor",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        messages: [{ role: "user", text: message, ts: Date.now() }],
      };

      const created = await createNewJsonFile(drive, folders.mentor, fileName, jsonObj);
      sessionId = created.fileId;

      const title = `Mentor Session — ${now.toLocaleString()}`;

      await db.collection("users").doc(user.uid).collection("mentor_sessions").doc(sessionId).set({
        fileId: sessionId,
        fileName: title,
        createdAt: now.toISOString(),
        type: "mentor",
      });

      history = jsonObj.messages;
    }

    /* ---------------- EXISTING SESSION ---------------- */
    else {
      const json = await readJsonFileSafe(drive, sessionId);
      history = json.messages || [];

      await appendMessageToJsonFile(drive, sessionId, {
        role: "user",
        text: message,
        ts: Date.now(),
      });
    }

    /* generate reply */
    let reply = await generateGeminiResponse(buildMentorPrompt(message), { userUid: user.uid });
    reply = limitLines(reply, 20);

    await appendMessageToJsonFile(drive, sessionId, {
      role: "assistant",
      text: reply,
      ts: Date.now(),
    });

    return res.json({ ok: true, reply, sessionId });

  } catch (err) {
    console.error("❌ mentorChat error:", err);
    return res.status(500).json({ ok: false, message: "Chat failed" });
  }
});

export default router;
