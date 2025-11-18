// src/routes/geminiGenerate.ts
import express, { Request, Response } from "express";
import { verifyJWT } from "../middleware/verifyJWT";
import { generateGeminiResponse } from "../services/geminiService";
import { db } from "../config/firebase";

const router = express.Router();

/**
 * Build exam-aware prompt
 * - supports objective-type competitive exams
 * - difficulty mapping applied per exam
 * - instruct Gemini to return strict JSON array
 */
function buildPrompt(params: {
  exam: string;
  subject: string;
  difficulty: "Easy" | "Medium" | "Hard";
  count: number;
}) {
  const { exam, subject, difficulty, count } = params;

  // Map exam => description to guide Gemini's vocabulary/format
  const examLabels: Record<string, string> = {
    GATE: "GATE (technical, engineering)",
    SSC: "SSC (government aptitude & reasoning)",
    BANK: "Bank PO/Clerk (aptitude/reasoning)",
    UPSC: "UPSC Prelims (general studies, objective)",
    CAT: "CAT (aptitude / logical / quantitative)",
    JEE: "JEE (physics/chemistry/maths objective)",
    NEET: "NEET (biology/chemistry/physics objective)",
    DEFAULT: exam,
  };

  const examLabel = (examLabels[exam.toUpperCase()] || examLabels["DEFAULT"]);

  // Difficulty guidance
  const difficultyGuidance: Record<string, string> = {
    Easy: "Beginner / basic level. Straightforward, short, mostly one-step.",
    Medium: "Exam-level difficulty for this exam (typical question style). Multi-step allowed.",
    Hard: "Advanced / above exam level. Multi-step reasoning and longer calculations.",
  };

  // Variation & freshness directive
  const freshness = `
Ensure high variation: do not repeat question phrasing, numbers, or structure from previous calls.
Use randomized numeric values where relevant. Shuffle options. Avoid identical templates.
`;

  // Output instructions
  const outputSpec = `
Return a JSON array ONLY (no explanatory text around JSON). Each item must be an object with:
{
  "id": "<unique id>",
  "type": "<MCQ|MSQ|NAT>",        // NAT = numeric answer type
  "marks": 1|2,
  "question": "<full question text>",
  "options": ["A ...", "B ...", "C ...", "D ..."] // for MCQ/MSQ; NAT can omit
  "correctAnswer": "<A|B|C|D|comma-separated for MSQ|numeric for NAT>",
  "explanation": "<short explanation for the answer>"
}
Make sure correctAnswer exactly matches one of options (or is numeric for NAT).
Return exactly ${count} items in the array.
`;

  // Combine prompt
  const prompt = `
You are an expert question author for competitive exams.
Exam: ${examLabel}
Subject: ${subject}
Difficulty: ${difficulty} (${difficultyGuidance[difficulty]})
Number of questions: ${count}

Rules:
- Output must follow strict JSON as specified below.
- Use the exam-style language and constraints for ${examLabel}.
- Use a mix of MCQ, MSQ and NAT as appropriate (for GATE include NAT & 2-mark where reasonable).
- For MCQ use 4 options. For MSQ use 4 options and correctAnswer can be comma-separated letters. For NAT provide a numeric answer (no units unless necessary).
${freshness}
${outputSpec}
`;

  return prompt;
}

/**
 * POST /generate
 * Body: { exam, subject, difficulty, numQuestions }
 * Auth required
 */
router.post("/generate", verifyJWT, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const exam = (req.body.exam || user?.preferredExam || "GATE").toString();
    const subject = (req.body.subject || "").toString();
    const difficulty = (req.body.difficulty || "Medium") as "Easy" | "Medium" | "Hard";
    const numQuestions = Math.min(50, Math.max(1, Number(req.body.numQuestions) || 10));

    if (!subject) return res.status(400).json({ ok: false, message: "subject required" });

    const prompt = buildPrompt({ exam, subject, difficulty, count: numQuestions });

    const raw = await generateGeminiResponse(prompt, { model: undefined, sessionId: undefined, userUid: user?.uid });

    // Try parse JSON from model output
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("Expected JSON array");
    } catch (errParse) {
      // Gemini didn't return clean JSON — attempt to extract JSON substring
      const match = raw.match(/\[.*\]/s);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (e) {
          console.error("Failed parsing extracted JSON:", e);
          return res.status(500).json({ ok: false, message: "AI returned invalid JSON" });
        }
      } else {
        console.error("Raw Gemini output (non-JSON):", raw);
        return res.status(500).json({ ok: false, message: "AI returned invalid response" });
      }
    }

    // Minimal validation: ensure required fields
    const validated = parsed.map((it: any, idx: number) => {
      return {
        id: it.id || `q-${Date.now()}-${idx}`,
        type: it.type || "MCQ",
        marks: it.marks || 1,
        question: it.question || (it.text || "").toString(),
        options: Array.isArray(it.options) ? it.options : (it.options ? [it.options] : []),
        correctAnswer: it.correctAnswer ?? it.answer ?? null,
        explanation: it.explanation || "",
      };
    });

    return res.json({ ok: true, data: validated });
  } catch (err: any) {
    console.error("POST /api/gemini/generate error:", err);
    return res.status(500).json({ ok: false, message: err?.message || "Failed to generate" });
  }
});

export default router;
