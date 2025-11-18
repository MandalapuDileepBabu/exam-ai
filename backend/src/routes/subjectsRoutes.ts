// src/routes/subjectsRoutes.ts
import express, { Request, Response } from "express";
import { verifyJWT } from "../middleware/verifyJWT"; // keep your existing middleware
const router = express.Router();

/**
 * Simple hardcoded subject lists per exam.
 * Replace with DB queries if you want dynamic lists.
 */
const SUBJECT_MAP: Record<string, string[]> = {
  GATE: [
    "Engineering Mathematics",
    "Digital Logic",
    "Computer Organization",
    "Data Structures",
    "Algorithms",
    "Theory of Computation",
    "Operating Systems",
    "Databases",
    "Computer Networks",
    "Compiler Design",
    "Software Engineering",
  ],
  JEE: [
    "Mathematics",
    "Physics",
    "Chemistry",
    "Mechanics",
    "Electrostatics",
    "Modern Physics",
  ],
  NEET: ["Physics", "Chemistry", "Biology"],
  CAT: ["Quantitative Ability", "Verbal Ability", "Data Interpretation", "Logical Reasoning"],
  UPSC: ["Polity", "History", "Geography", "Economy", "Environment"],
};

/**
 * GET /:exam/subjects
 * Returns subject list for given exam.
 */
router.get("/:exam/subjects", verifyJWT, async (req: Request, res: Response) => {
  try {
    const exam = (req.params.exam || "GATE").toUpperCase();
    const subjects = SUBJECT_MAP[exam] ?? SUBJECT_MAP["GATE"];
    return res.json({ ok: true, exam, subjects });
  } catch (err: any) {
    console.error("Error fetching subjects:", err);
    return res.status(500).json({ ok: false, message: "Failed to fetch subjects" });
  }
});

/**
 * POST /practice
 * Body: { exam, subject, difficulty, count }
 * For now this returns synthetic questions using templates.
 * You can replace internals with Gemini generation when ready.
 */
router.post("/practice", verifyJWT, async (req: Request, res: Response) => {
  try {
    const { exam = "GATE", subject = "", difficulty = "Easy", count = 10 } = req.body;

    if (!subject) return res.status(400).json({ ok: false, message: "Subject required" });

    const n = Math.min(50, Math.max(1, Number(count) || 10));
    const questions: string[] = [];

    // Simple templating by difficulty
    const templates: Record<string, string[]> = {
      Easy: [
        `Explain the basic concept of {topic}.`,
        `What is the definition of {topic}? Give one example.`,
        `Choose the best option: which statement about {topic} is true?`
      ],
      Medium: [
        `Solve: A problem involving {topic}. Provide steps.`,
        `Derive the formula related to {topic} and explain assumptions.`,
        `Compare and contrast {topic} with a close topic.`
      ],
      Hard: [
        `Design an algorithm to handle {topic} under constraints; analyze complexity.`,
        `Prove a key theorem related to {topic} or provide a counterexample.`,
        `Advanced problem: combine {topic} with another concept and solve.`
      ],
    };

    // pick a topic filler list (small)
    const topicExamples = [
      subject,
      `${subject} - core concept`,
      `${subject} application`,
      `${subject} tricky case`,
      `${subject} past-year style`
    ];

    const choices = templates[difficulty] ?? templates["Easy"];

    for (let i = 0; i < n; i++) {
      const t = choices[i % choices.length];
      const topic = topicExamples[i % topicExamples.length];
      const q = t.replace(/\{topic\}/g, topic);
      questions.push(`${i + 1}. ${q}`);
    }

    const text = questions.join("\n\n");
    return res.json({ ok: true, questions: text });
  } catch (err: any) {
    console.error("practice error:", err);
    return res.status(500).json({ ok: false, message: "Failed to generate practice questions" });
  }
});

export default router;
