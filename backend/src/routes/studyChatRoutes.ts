// src/routes/studyChatRoutes.ts
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

/* ------------------------------------------------------- */
/* Helpers                                                 */
/* ------------------------------------------------------- */

function limitLines(text: any, maxLines = 10) {
  return String(text || "")
    .split("\n")
    .map((l) => String(l).trim())
    .filter(Boolean)
    .slice(0, maxLines)
    .join("\n");
}

function detectTargetQuestion(message: string, questions: any[] = []) {
  if (!Array.isArray(questions) || questions.length === 0) return null;

  const match = message.match(/(?:q|question|solve|explain|answer)\s*\.?\s*(\d+)/i);
  if (!match) return null;

  const num = Number(match[1]);
  if (Number.isNaN(num)) return null;

  const found =
    questions.find((q) => q.number === num || q.id === `q${num}`) ||
    questions[num - 1];

  return found ? { ...found, number: num } : null;
}

/* Build prompt */
function buildStudyPrompt(userMessage: string, exam: string, subject: string, q: any | null, history: any[]) {
  const historyLines = history
    .slice(-7)
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.text}`)
    .join("\n");

  const base = `
You are a concise ${exam} exam study assistant for subject "${subject}".
Reply in <= 10 short lines.

Recent Context:
${historyLines || "(none)"}

User: "${userMessage}"
`.trim();

  if (!q) return `${base}\n\nNo referenced question detected. Respond normally.`;

  return `
${base}

Referenced Question ${q.number}:
${q.question}

A) ${q.options?.A || ""}
B) ${q.options?.B || ""}
C) ${q.options?.C || ""}
D) ${q.options?.D || ""}

Correct answer: ${q.correctAnswer || q.answer || ""}

Give a short, crisp explanation (2–4 sentences).
  `.trim();
}

/* ------------------------------------------------------- */
/* Main Study Chat Endpoint                                */
/* ------------------------------------------------------- */

router.post("/", verifyJWT, async (req, res) => {
  try {
    const { message, sessionId: incomingId, newSession = false, questions } = req.body;
    const uid = (req as any).user?.uid;

    if (!uid) return res.status(401).json({ ok: false });
    if (!message) return res.status(400).json({ ok: false, message: "Message required" });

    const userDoc = await db.collection("users").doc(uid).get();
    const exam = userDoc.data()?.preferredExam || "GATE";
    const subject = userDoc.data()?.preferredSubject || "General";

    const drive = await getDriveClient();
    const folders = await ensureUserDriveStructure(uid);

    let sessionId = incomingId;
    let history: any[] = [];

    /* ---------------- NEW SESSION ---------------- */
    if (newSession || !sessionId) {
      const now = new Date();
      const fileName = `study_session_${now.getTime()}.json`;

      const jsonObj = {
        type: "study",
        exam,
        subject,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        messages: [{ role: "user", text: message, ts: Date.now() }],
      };

      const created = await createNewJsonFile(drive, folders.study, fileName, jsonObj);
      sessionId = created.fileId;

      const readableTitle = `Study — ${subject} (${now.toLocaleString()})`;

      await db.collection("users").doc(uid).collection("study_sessions").doc(sessionId).set({
        fileId: sessionId,
        fileName: readableTitle,
        createdAt: now.toISOString(),
        type: "study",
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

    /* detect reference */
    const qBlock = detectTargetQuestion(message, questions);

    /* generate reply */
    const prompt = buildStudyPrompt(message, exam, subject, qBlock, history);
    let reply = await generateGeminiResponse(prompt, { userUid: uid });
    reply = limitLines(reply, 10);

    await appendMessageToJsonFile(drive, sessionId, {
      role: "assistant",
      text: reply,
      ts: Date.now(),
    });

    return res.json({ ok: true, reply, sessionId });
  } catch (err) {
    console.error("❌ Study Chat Error:", err);
    return res.status(500).json({ ok: false, message: "Chat failed" });
  }
});

export default router;
