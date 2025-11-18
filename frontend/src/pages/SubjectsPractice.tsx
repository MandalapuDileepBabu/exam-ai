// src/pages/SubjectsPractice.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "../styles/subjects.module.css";

import ChatPopup from "../components/ChatPopup";
import OmSidebar from "../components/OmSidebar";
import ExamBody from "../components/ExamBody";
import { createExamModeHandlers } from "../lib/ExamMode";

const API =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

type Toast = {
  id: number;
  text: string;
  kind?: "info" | "error" | "success";
};

export default function SubjectsPractice(): JSX.Element {
  const token =
    (typeof window !== "undefined" && localStorage.getItem("exam_ai_token")) ||
    "";
  const user =
    (typeof window !== "undefined" &&
      JSON.parse(localStorage.getItem("exam_ai_user") || "null")) ||
    {};

  const exam = (user?.preferredExam || user?.exam || "GATE").toString();

  const [subjects, setSubjects] = useState<string[]>([]);
  const [subject, setSubject] = useState<string>("");

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Easy");
  const [count, setCount] = useState<number>(10);

  const [isGenerating, setIsGenerating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [questions, setQuestions] = useState<QuestionObj[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<any | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const [chatOpen, setChatOpen] = useState(false);
  const [mentorToken] = useState<string>(token);
  const [omToken] = useState<string>(token);

  const [messages, setMessages] = useState<
    { id: string; role: "user" | "assistant"; text: string }[]
  >([]);
  const [bottomChatInput, setBottomChatInput] = useState("");

  const [examMode, setExamMode] = useState(false);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Toast utility
  const pushToast = (
    text: string,
    kind: Toast["kind"] = "info",
    ms = 3000
  ) => {
    const id = Date.now() + Math.floor(Math.random() * 999);
    setToasts((old) => [...old, { id, text, kind }]);
    setTimeout(() => {
      setToasts((old) => old.filter((x) => x.id !== id));
    }, ms);
  };

  // Fetch available subjects
  useEffect(() => {
    let mounted = true;
    fetch(`${API}/subjects/${encodeURIComponent(exam)}/subjects`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        if (d?.ok && Array.isArray(d.subjects)) {
          setSubjects(d.subjects);
          if (!subject && d.subjects.length) setSubject(d.subjects[0]);
        } else if (Array.isArray(d)) {
          setSubjects(d);
          if (!subject && d.length) setSubject(d[0]);
        } else {
          setSubjects([]);
          pushToast("No subjects returned.", "error");
        }
      })
      .catch((err) => {
        console.error("Error fetching subjects:", err);
        pushToast("Failed to fetch subjects.", "error");
      });

    return () => { mounted = false; };
  }, [exam, token, subject]);

  // Build prompt for AI generation
  const buildPromptJSON = (opts: {
    exam: string;
    subject: string;
    difficulty: string;
    count: number;
  }) => {
    const { exam, subject, difficulty, count } = opts;
    const difficultyNote =
      difficulty === "Easy"
        ? "Easy: straightforward one-step problems."
        : difficulty === "Medium"
        ? "Medium: typical exam multi-step problems."
        : "Hard: tricky multi-concept problems.";
    return `
You are an exam question generator. Produce exactly ${count} questions for the exam "${exam}" and subject "${subject}".
Output MUST be a JSON array with:
id, type ("MCQ"|"MSQ"|"NAT"), marks (1|2), question, options {A,B,C,D}, correctAnswer, explanation.
Difficulty: ${difficultyNote}

Return ONLY JSON.
`.trim();
  };

  // Safely parse possible JSON from output
  const parseMaybeJSON = (text: string) => {
    try {
      const first = text.indexOf("[");
      const last = text.lastIndexOf("]");
      if (first >= 0 && last > first) {
        return JSON.parse(text.slice(first, last + 1));
      }
      return JSON.parse(text);
    } catch (err) {
      console.warn("JSON parse error:", err);
      return null;
    }
  };

  // Generate questions
  const generateQuestions = async () => {
    if (!subject) {
      pushToast("Select a subject first", "error");
      return;
    }
    setIsGenerating(true);
    pushToast("Generating questions…");

    const prompt = buildPromptJSON({ exam, subject, difficulty, count });
    try {
      const res = await fetch(`${API}/gemini/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt,
          model: "gemini-2.5-flash",
          numQuestions: count,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast("Failed to generate.", "error");
        setIsGenerating(false);
        return;
      }
      const raw = data.data || data.text || data.output || JSON.stringify(data);
      const parsed = parseMaybeJSON(typeof raw === "string" ? raw : JSON.stringify(raw));
      if (!Array.isArray(parsed)) {
        pushToast("Failed to parse generated questions.", "error");
        console.log("Raw generator output:", raw);
        setIsGenerating(false);
        return;
      }
      const qs: QuestionObj[] = parsed.map((it: any, i: number) => {
        const id = String(it.id || `q_${Date.now()}_${i}`);
        const type = (it.type || "MCQ").toUpperCase() as any;
        const marks = Number(it.marks || (i % 3 === 0 ? 2 : 1));
        const opts = it.options || {};
        return {
          id,
          type,
          marks,
          question: it.question || it.text || "",
          options: {
            A: opts.A || opts.a || "",
            B: opts.B || opts.b || "",
            C: opts.C || opts.c || "",
            D: opts.D || opts.d || "",
          },
          correctAnswer: it.correctAnswer || "",
          explanation: it.explanation || "",
        };
      });
      setQuestions(qs);
      setAnswers({});
      setResults(null);
      pushToast(`Generated ${qs.length} questions.`, "success");
    } catch (err) {
      console.error("Gen error:", err);
      pushToast("Generation failed.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // Chat message send
  const sendBottomChat = async () => {
    const text = bottomChatInput.trim();
    if (!text) return;
    if (examMode) {
      pushToast("Chat disabled in exam mode", "error");
      return;
    }
    const uid = `u_${Date.now()}`;
    const aid = `a_${Date.now()}`;

    setMessages((m) => [...m, { id: uid, role: "user", text }]);
    setBottomChatInput("");
    setMessages((m) => [...m, { id: aid, role: "assistant", text: "..." }]);
    try {
      const res = await fetch(`${API}/ai/study`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text, newSession: true }),
      });
      const d = await res.json();
      const reply = d.reply || d.text || "No reply";
      setMessages((m) =>
        m.map((msg) =>
          msg.id === aid ? { ...msg, text: reply } : msg
        )
      );
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === aid ? { ...msg, text: "Assistant error" } : msg
        )
      );
    }
  };

  // Exam submission
  const submitAll = async () => {
    if (!questions.length) {
      pushToast("No questions to submit", "error");
      return;
    }
    const payload = questions.map((q) => ({
      id: q.id,
      type: q.type,
      marks: q.marks,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    }));
    try {
      const res = await fetch(`${API}/exams/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          exam,
          subject,
          difficulty,
          questions: payload,
          answers,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setResults(data);
        pushToast("Exam submitted!", "success");
        handlers.disable();
        setExamMode(false);
      } else {
        pushToast("Submit failed", "error");
      }
    } catch (err) {
      console.error("Submit error:", err);
      pushToast("Submit error", "error");
    }
  };

  const setAnswerFor = (qid: string, val: string) => {
    setAnswers((a) => ({ ...a, [qid]: val }));
  };

  // Auto-scroll for chat + exam area only
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollAreaRef.current) {
      requestAnimationFrame(() => {
        scrollAreaRef.current!.scrollTop =
          scrollAreaRef.current!.scrollHeight;
      });
    }
  }, [messages.length, questions.length]);

  // Dropdown outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () =>
      document.removeEventListener("mousedown", handler);
  }, []);

  // OmSidebar session loader
  const handleLoadSession = async (
    sessionId: string,
    type: "mentor" | "subject"
  ) => {
    try {
      const res = await fetch(
        `${API}/ai/history?fileId=${encodeURIComponent(sessionId)}&type=${type}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const d = await res.json();
      if (d?.content) {
        const lines = d.content.split(/\r?\n/).filter(Boolean);
        const parsed = lines.map((ln, idx) => {
          if (ln.startsWith("[User]:"))
            return {
              id: `u_${idx}`,
              role: "user",
              text: ln.replace("[User]:", "").trim(),
            };
          if (ln.startsWith("[Assistant]:"))
            return {
              id: `a_${idx}`,
              role: "assistant",
              text: ln.replace("[Assistant]:", "").trim(),
            };
          return {
            id: `o_${idx}`,
            role: "assistant",
            text: ln.trim(),
          };
        });
        setMessages(parsed);
        setChatOpen(true);
        pushToast("Loaded session", "success");
      } else {
        pushToast("Failed to load session", "error");
      }
    } catch (err) {
      console.error("Session load error:", err);
      pushToast("Failed to load session", "error");
    }
  };

  // Exam mode handlers
  const handlers = createExamModeHandlers({
    submitAll,
    pushToast,
  });

  useEffect(() => {
    if (examMode) handlers.enable();
    else handlers.disable();
    return () => handlers.cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examMode]);

  /* ---- Render ---- */
  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <button
    aria-label="Toggle sidebar"
    className={styles.sidebarToggleBtn}
    onClick={() => setSidebarOpen((open) => !open)}
  >
    ॐ
  </button>
        <button
          className={styles.backBtn}
          onClick={() => window.history.back()}
        >
          ← Back
        </button>
        <h1 className={styles.title}>{exam} — Subjects</h1>
        <button
          className={styles.logoutBtn}
          onClick={() => {
            localStorage.removeItem("exam_ai_token");
            localStorage.removeItem("exam_ai_user");
            window.location.href = "/";
          }}
        >
          Logout
        </button>
      </header>

      {/* Sticky Filter Row */}
      <div className={styles.filterRowInline}>
        <div
          className={styles.customSelectWrap}
          ref={dropdownRef}
          style={{
            width: useMemo(() => {
              const base = 340;
              const per = 60;
              const calc = Math.min(
                1000,
                base + Math.max(0, subjects.length - 4) * per
              );
              return `${calc}px`;
            }, [subjects.length]),
          }}
        >
          <button
            className={styles.customSelectTrigger}
            onClick={() => setDropdownOpen((p) => !p)}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
          >
            <span>
              {subject ||
                (subjects.length ? "Select subject" : "Loading…")}
            </span>
            <span className={styles.caret}>
              {dropdownOpen ? "▲" : "▼"}
            </span>
          </button>

          {dropdownOpen && (
            <div
              className={`${styles.customDropdown} ${styles.open}`}
              role="listbox"
            >
              <div className={styles.subjectList}>
                {subjects.length === 0 ? (
                  <div className={styles.noSubjects}>No subjects</div>
                ) : (
                  subjects.map((s) => (
                    <div
                      key={s}
                      className={`${styles.subjectListItem} ${
                        subject === s
                          ? styles.subjectSelected
                          : ""
                      }`}
                      onClick={() => {
                        setSubject(s);
                        setDropdownOpen(false);
                      }}
                    >
                      {s}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        {/* Difficulty selector */}
        <select
          className={styles.inlineSelect}
          value={difficulty}
          onChange={(e) =>
            setDifficulty(
              e.target.value as "Easy" | "Medium" | "Hard"
            )
          }
        >
          <option>Easy</option>
          <option>Medium</option>
          <option>Hard</option>
        </select>
        {/* Question count */}
        <input
          className={styles.inlineNumber}
          type="number"
          min={1}
          max={50}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
        />
        {/* Generate button */}
        <button
          className={styles.generateBtn}
          onClick={generateQuestions}
          disabled={!subject || isGenerating}
        >
          {isGenerating ? "Generating…" : "Generate"}
        </button>
        {/* Exam mode button */}
        <button
          className={styles.generateBtn}
          style={{
            marginLeft: 8,
            background: examMode ? "#ef4444" : undefined,
          }}
          onClick={() => {
            if (!questions.length) {
              pushToast("Generate questions first", "error");
              return;
            }
            setExamMode((e) => !e);
            if (!examMode)
              pushToast(
                "Exam mode enabled — entering fullscreen",
                "info"
              );
            else {
              pushToast("Exam mode disabled", "info");
              handlers.disable();
            }
          }}
        >
          {examMode ? "Exit Test" : "Take Exam"}
        </button>
      </div>

      {/* MAIN SCROLLABLE AREA */}
      <div className={styles.scrollArea} ref={scrollAreaRef}>
        {/* Chat messages */}
        {messages.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent:
                    m.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: 8,
                }}
              >
                <div className={`${styles.messageCard} ${
                  m.role === "user"
                    ? styles.messageUser
                    : styles.messageAssistant
                }`}>
                  <div className={styles.messageText}>{m.text}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Exam body */}
        <ExamBody
          questions={questions}
          answers={answers}
          setAnswerFor={setAnswerFor}
          results={results}
          isReviewMode={false}
          examMode={examMode}
        />
        {/* Results */}
        {results && (
          <div style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.04)",
            background: "rgba(255,255,255,0.01)",
          }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>
              Score: {results.score?.obtained} / {results.score?.totalMarks}
            </div>
            <div style={{ marginTop: 8 }}>
              Correct: {results.score?.correctCount}
            </div>
          </div>
        )}
      </div>
        
      {/* CHAT BAR (fixed above submit button) */}
      <div
        className={styles.chatBar}
        style={{
          left: "unset",
          right: "50%",
          transform: "translateX(50%)",
        }}
      >
        <label className={styles.uploadBtn} title="Upload material">
          <input
            type="file"
            accept="*/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const form = new FormData();
              form.append("file", f);
              fetch(`${API}/upload/material`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: form,
              })
                .then((r) => r.json())
                .then((d) =>
                  d.ok
                    ? pushToast("Uploaded", "success")
                    : pushToast("Upload failed", "error")
                )
                .catch(() => pushToast("Upload error", "error"));
              (e.target as HTMLInputElement).value = "";
            }}
          />
          <span>📤</span>
        </label>
        <input
          className={styles.chatInput}
          placeholder={
            examMode
              ? "Chat disabled during test"
              : "Ask focused questions about the subject here…"
          }
          value={bottomChatInput}
          disabled={examMode}
          onChange={(e) => setBottomChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendBottomChat();
          }}
        />
        <button
          className={styles.sendBtn}
          disabled={examMode}
          onClick={sendBottomChat}
        >
          ➤
        </button>
      </div>

      {/* CHAT POPUP/FAB unchanged */}
      <button
        className={styles.chatFab}
        onClick={() => setChatOpen(true)}
      >
        💬
      </button>
      {chatOpen && (
        <ChatPopup
          onClose={() => setChatOpen(false)}
          token={mentorToken}
        />
      )}

      {/* OM SIDEBAR unchanged */}
      <OmSidebar
  token={omToken}
  onLoadSession={handleLoadSession}
  open={sidebarOpen}
  onClose={() => setSidebarOpen(false)}
/>


      {/* FIXED SUBMIT BUTTON */}
      {examMode && questions.length > 0 && (
        <div className={styles.fixedSubmit}>
          <button
            onClick={() => {
              if (window.confirm("Submit exam now?")) submitAll();
            }}
            className={styles.fixedSubmitBtn}
          >
            SUBMIT ALL
          </button>
        </div>
      )}

      {/* Toasts unchanged */}
      <div
        style={{
          position: "fixed",
          right: 20,
          bottom: 160,
          zIndex: 30000,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              minWidth: 220,
              maxWidth: 420,
              padding: "10px 14px",
              borderRadius: 10,
              background:
                t.kind === "error"
                  ? "linear-gradient(90deg,#f87171,#ef4444)"
                  : t.kind === "success"
                  ? "linear-gradient(90deg,#34d399,#10b981)"
                  : "rgba(255,255,255,0.04)",
              color: t.kind ? "#041f1a" : "#e6eef7",
              fontWeight: 700,
              boxShadow: "0 8px 30px rgba(2,6,23,0.6)",
            }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
