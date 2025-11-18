// src/services/geminiService.ts
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { db } from "../config/firebase";

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY || "";
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

if (!API_KEY) console.warn("⚠️ GEMINI_API_KEY not set in env — Gemini calls will fail.");

const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Generate a response from Gemini (single prompt)
 * Also logs the request/response in Firestore under `ai_sessions` (optional session)
 */
export async function generateGeminiResponse(prompt: string, opts?: { model?: string, sessionId?: string, userUid?: string }) {
  try {
    const model = opts?.model || DEFAULT_MODEL;
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    const text = (response as any).text ?? "";

    // store in Firestore - keep lightweight
    try {
      const sessionRef = opts?.sessionId
        ? db.collection("ai_sessions").doc(opts.sessionId)
        : db.collection("ai_sessions").doc();

      await sessionRef.set({
        model,
        lastPrompt: prompt,
        lastResponse: text,
        updatedAt: new Date().toISOString(),
        userUid: opts?.userUid || null,
      }, { merge: true });

      // add message entry
      await sessionRef.collection("messages").add({
        role: "assistant",
        text,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("⚠️ Failed to persist Gemini session:", e);
    }

    return text;
  } catch (err: any) {
    console.error("❌ Gemini error:", err);
    throw new Error("Gemini request failed: " + (err?.message ?? "unknown"));
  }
}
