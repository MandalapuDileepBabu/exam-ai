// src/components/ExamBody.tsx
import React from "react";
import styles from "../styles/subjects.module.css";

export type QuestionObj = {
  id: string;
  type: "MCQ" | "MSQ" | "NAT";
  marks: number;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer?: string;
  explanation?: string;
};

type Props = {
  questions: QuestionObj[];
  answers: Record<string, string>;
  examMode: boolean; // only when true may user answer questions
  setAnswerFor: (qid: string, val: string) => void;
  results: any | null;
  isReviewMode: boolean;
};

const ExamBody: React.FC<Props> = ({
  questions,
  answers,
  examMode,
  setAnswerFor,
  results,
  isReviewMode,
}) => {
  if (!questions || questions.length === 0) {
    return (
      <div style={{ opacity: 0.9, padding: 12 }}>
        No questions — generate a practice set to begin.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {questions.map((q, idx) => {
        const answeredRaw = (answers[q.id] ?? "").toString();
        const answeredNormalized = answeredRaw.trim();

        return (
          <article key={q.id} className={styles.questionCard} aria-labelledby={`q-${q.id}`}>
            {/* Header */}
            <div className={styles.questionHeader}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "baseline",
                  width: "100%",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ fontWeight: 800 }}>
                  <span id={`q-${q.id}`} className={styles.qIndex}>
                    {idx + 1}.
                  </span>{" "}
                  <span className={styles.qText}>{q.question}</span>
                </div>

                <div style={{ fontWeight: 800, opacity: 0.85 }}>
                  {q.marks}m • {q.type}
                </div>
              </div>
            </div>

            {/* Options / Input */}
            <div className={styles.optionsWrap} style={{ marginTop: 10 }}>
              {q.type !== "NAT" ? (
                (["A", "B", "C", "D"] as const).map((opt) => {
                  const isChecked =
                    q.type === "MSQ"
                      ? answeredNormalized
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .includes(opt)
                      : answeredNormalized.toUpperCase() === opt;

                  return (
                    <label
                      key={opt}
                      className={styles.optionItem}
                      style={{
                        background:
                          examMode && isChecked && !isReviewMode
                            ? "rgba(59,130,246,0.14)"
                            : "transparent",
                      }}
                    >
                      <input
                        type={q.type === "MSQ" ? "checkbox" : "radio"}
                        name={`q_${q.id}`}
                        value={opt}
                        aria-label={`Option ${opt} for question ${idx + 1}`}
                        disabled={!examMode || isReviewMode}
                        checked={isChecked}
                        onChange={(e) => {
                          if (!examMode || isReviewMode) return;

                          if (q.type === "MSQ") {
                            const prev = (answeredNormalized || "")
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean);
                            if ((e.target as HTMLInputElement).checked) {
                              const next = Array.from(new Set([...prev, opt]));
                              setAnswerFor(q.id, next.join(","));
                            } else {
                              const next = prev.filter((x) => x !== opt);
                              setAnswerFor(q.id, next.join(","));
                            }
                          } else {
                            setAnswerFor(q.id, opt);
                          }
                        }}
                      />

                      <div style={{ fontWeight: 700, minWidth: 20 }}>{opt})</div>
                      <div style={{ opacity: 0.95 }}>{q.options[opt]}</div>
                    </label>
                  );
                })
              ) : (
                <div className={styles.answerInputWrap}>
                  <input
                    className={styles.answerInput}
                    placeholder="Numeric answer"
                    aria-label={`Numeric answer for question ${idx + 1}`}
                    disabled={!examMode || isReviewMode}
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswerFor(q.id, e.target.value)}
                    inputMode="decimal"
                  />
                </div>
              )}
            </div>

            {/* Review / Result block: shown if results exist and include a detail for this question */}
            {results &&
              results.details &&
              (() => {
                const detail = results.details.find((d: any) => d.id === q.id);
                if (!detail) return null;

                return (
                  <section
                    aria-live="polite"
                    style={{
                      marginTop: 10,
                      padding: 10,
                      borderRadius: 10,
                      background: detail.isCorrect
                        ? "rgba(16,185,129,0.06)"
                        : "rgba(239,68,68,0.04)",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        color: detail.isCorrect ? "#34d399" : "#f87171",
                      }}
                    >
                      {detail.isCorrect ? "Correct" : "Wrong"} — Your:{" "}
                      {detail.userAnswer ?? "—"} • Correct: {detail.correctAnswer}
                    </div>

                    {detail.explanation && (
                      <div style={{ marginTop: 8 }}>{detail.explanation}</div>
                    )}
                  </section>
                );
              })()}
          </article>
        );
      })}
    </div>
  );
};

export default ExamBody;
