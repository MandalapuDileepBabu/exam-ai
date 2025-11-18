// src/routes/examSubmit.ts
import express, { Request, Response } from "express";
import { verifyJWT } from "../middleware/verifyJWT";
import { db } from "../config/firebase";
import {
  getDriveClient,
  ensureUserDriveStructure,
  uploadBufferToDrive,
} from "../services/driveService";

const router = express.Router();

/**
 * POST /submit
 *
 * Body: { exam, subject, difficulty, questions, answers }
 *
 * Behavior:
 * - Build a human-readable .txt summary of the attempt
 * - Upload that file to Drive under users/<uid>/history/exam/
 * - Save only a pointer + score metadata to Firestore:
 *   users/<uid>/exam_history/{docId} => { fileId, fileUrl, fileName, createdAt, type: "exam", score }
 */
router.post("/submit", verifyJWT, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const uid = user?.uid;
    if (!uid) return res.status(401).json({ ok: false, message: "Unauthorized" });

    const { exam, subject, difficulty, questions, answers } = req.body;
    if (!Array.isArray(questions))
      return res.status(400).json({ ok: false, message: "questions required" });

    let correctCount = 0;
    let totalMarks = 0;
    let obtained = 0;

    const perQuestionResults: any[] = [];

    for (const q of questions) {
      totalMarks += Number(q.marks || 1);
      const userAnsRaw = answers?.[q.id];
      let isCorrect = false;

      const type = (q.type || "MCQ").toUpperCase();

      if (type === "NAT") {
        isCorrect =
          String(q.correctAnswer).trim() === (userAnsRaw ?? "").toString().trim();
      } else if (type === "MSQ") {
        const exp = String(q.correctAnswer || "")
          .split(",")
          .map((s: string) => s.trim().toUpperCase())
          .sort();
        const got = String(userAnsRaw || "")
          .split(",")
          .map((s: string) => s.trim().toUpperCase())
          .sort();
        isCorrect = JSON.stringify(exp) === JSON.stringify(got);
      } else {
        isCorrect =
          String(q.correctAnswer || "").trim().toUpperCase() ===
          String(userAnsRaw || "").trim().toUpperCase();
      }

      if (isCorrect) {
        correctCount++;
        obtained += Number(q.marks || 1);
      }

      perQuestionResults.push({
        id: q.id,
        question: q.question,
        correctAnswer: q.correctAnswer,
        userAnswer: userAnsRaw ?? null,
        isCorrect,
        marks: q.marks || 1,
        explanation: q.explanation || "",
      });
    }

    const score = { obtained, totalMarks, correctCount };

    const attemptMeta = {
      uid,
      exam,
      subject,
      difficulty,
      timestamp: new Date().toISOString(),
      score,
    };

    /* ---------------------------------------------------------------------- */
    /* Build summary text (human-readable)                                    */
    /* ---------------------------------------------------------------------- */
    const lines: string[] = [];
    lines.push(`Exam: ${exam}`);
    lines.push(`Subject: ${subject}`);
    lines.push(`Difficulty: ${difficulty}`);
    lines.push(`Timestamp: ${attemptMeta.timestamp}`);
    lines.push(`Score: ${obtained} / ${totalMarks}`);
    lines.push("");
    perQuestionResults.forEach((r: any, idx: number) => {
      lines.push(`${idx + 1}. ${r.question}`);
      if (r.userAnswer !== null) lines.push(`Your answer: ${r.userAnswer}`);
      lines.push(`Correct answer: ${r.correctAnswer}`);
      lines.push(`Result: ${r.isCorrect ? "Correct" : "Wrong"}`);
      if (r.explanation) lines.push(`Explanation: ${r.explanation}`);
      lines.push("");
    });

    const fileBuffer = Buffer.from(lines.join("\n"), "utf8");
    const fileName = `${exam || "exam"}_${subject || "subject"}_attempt_${Date.now()}.txt`;

    /* ---------------------------------------------------------------------- */
    /* Upload to Drive under users/<uid>/history/exam/                        */
    /* ---------------------------------------------------------------------- */
    try {
      const driveService = require("../services/driveService");
      const drive = await driveService.getDriveClient();
      const folders = await driveService.ensureUserDriveStructure(uid);

      // ensure exam subfolder exists under history (create if missing)
      // We'll check if an 'exam' folder exists and create if needed
      const historyFolderId = folders.history;
      let examFolderId = null;
      try {
        const list = await drive.files.list({
          q: `'${historyFolderId}' in parents and name='exam' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: "files(id, name)",
          supportsAllDrives: true,
        });
        if (list.data.files?.length) examFolderId = list.data.files[0].id!;
        else {
          const createdFolder = await drive.files.create({
            requestBody: {
              name: "exam",
              mimeType: "application/vnd.google-apps.folder",
              parents: [historyFolderId],
            },
            fields: "id",
            supportsAllDrives: true,
          });
          examFolderId = createdFolder.data.id!;
        }
      } catch (innerErr) {
        console.warn("⚠️ Could not ensure exam folder, falling back to history folder:", innerErr);
        examFolderId = historyFolderId;
      }

      const uploadResult = await driveService.uploadBufferToDrive(
        drive,
        fileBuffer,
        fileName,
        "text/plain",
        examFolderId
      );

      // Store only pointer + score metadata in Firestore (no questions or answers)
      const pointerRef = db.collection("users").doc(uid).collection("exam_history").doc();
      await pointerRef.set({
        fileId: uploadResult.fileId,
        fileUrl: uploadResult.url,
        fileName,
        createdAt: new Date().toISOString(),
        type: "exam",
        score,
      });

      return res.json({
        ok: true,
        attemptId: pointerRef.id,
        score,
        details: perQuestionResults,
      });
    } catch (driveErr) {
      console.warn("⚠️ Failed to upload attempt summary to Drive:", driveErr);
      // In case of Drive failure, still return the computed score and details
      return res.json({
        ok: true,
        attemptId: null,
        score,
        details: perQuestionResults,
        warning: "Drive upload failed - attempt not stored in Drive",
      });
    }
  } catch (err: any) {
    console.error("❌ examSubmit error:", err);
    return res.status(500).json({ ok: false, message: err.message || "Failed to submit" });
  }
});

export default router;
