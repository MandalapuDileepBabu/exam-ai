// src/app.ts
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";

// Import routes
import authRoutes from "./routes/authRoutes";
import uploadRoutes from "./routes/uploadRoutes";
import superadminRoutes from "./routes/superadminRoutes";
import geminiRoutes from "./routes/geminiRoutes";
import googleOAuthRoutes from "./routes/googleOAuthRoutes";
import subjectsRoutes from "./routes/subjectsRoutes";
import examSubmitRoutes from "./routes/examSubmit";

import studyChatRoutes from "./routes/studyChatRoutes";
import mentorChatRoutes from "./routes/mentorChatRoutes"; // ChatPopup backend
import historyRoutes from "./routes/historyRoutes";



dotenv.config();

const app = express();

/* -------------------------------------------------------------------------- */
/* 🟩 1. Middleware Setup                                                     */
/* -------------------------------------------------------------------------- */

app.use(
  cors({
    origin: "http://localhost:5173", // Vite frontend
    credentials: true,
  })
);

app.use(express.json());

// Allow OAuth popup window to close correctly
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});

// Basic recommended security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

/* -------------------------------------------------------------------------- */
/* 🟩 2. Health Check Route                                                   */
/* -------------------------------------------------------------------------- */
app.get("/health", (_: Request, res: Response) => {
  res.status(200).json({ message: "✅ Exam-AI backend is running" });
});

/* -------------------------------------------------------------------------- */
/* 🟩 3. Main Route Mounting                                                  */
/* -------------------------------------------------------------------------- */

// OAuth (Google Drive authorization)
app.use("/", googleOAuthRoutes);

// Core routes
app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/superadmin", superadminRoutes);
app.use("/api/gemini", geminiRoutes);
app.use("/api/subjects", subjectsRoutes);
app.use("/api/exams", examSubmitRoutes);

// NEW: AI chat systems
app.use("/api/ai/study", studyChatRoutes);   // bottom subject practice chat
app.use("/api/ai/mentor", mentorChatRoutes); // floating ChatPopup
app.use("/api/history", historyRoutes);
/* -------------------------------------------------------------------------- */
/* 🟩 4. Global Error Handler                                                 */
/* -------------------------------------------------------------------------- */
app.use(
  (err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("❌ Uncaught Error:", err);

    res.status(500).json({
      message: "Internal Server Error",
      error: err?.message || err?.toString(),
    });
  }
);

export default app;
