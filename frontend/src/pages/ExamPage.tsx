import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "../styles/exam.module.css";

const EXAMS = ["GATE", "JEE", "NEET", "CAT", "UPSC"];

type CardProps = {
  title: string;
  onClick?: () => void;
  className?: string;
};

const Card: React.FC<CardProps> = ({ title, onClick, className }) => (
  <motion.button
    className={`${styles.card} ${className ?? ""}`}
    onClick={onClick}
    whileHover={{
      scale: 1.04,
      boxShadow: "0 0 24px rgba(0,255,255,0.25)",
      borderColor: "rgba(0,255,255,0.4)",
    }}
    transition={{ type: "spring", stiffness: 200, damping: 16 }}
    aria-label={title}
  >
    <span className={styles.cardText}>{title}</span>
  </motion.button>
);

export default function ExamPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [examsOpen, setExamsOpen] = useState(false);

  const [selectedExam, setSelectedExam] = useState<string | null>(null);

  const headerLeftRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // ✅ Load previously selected exam from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("exam_ai_user");
    if (!storedUser) return;

    try {
      const user = JSON.parse(storedUser);
      if (user.preferredExam) {
        setSelectedExam(user.preferredExam);
      }
    } catch {}
  }, []);

  // close dropdown when clicking outside
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuOpen) return;
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        headerLeftRef.current &&
        !dropdownRef.current.contains(target) &&
        !headerLeftRef.current.contains(target)
      ) {
        setMenuOpen(false);
        setExamsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  // ✅ Save selected exam to backend + localStorage
  const onSelectExam = async (exam: string) => {
    setSelectedExam(exam);
    setMenuOpen(false);
    setExamsOpen(false);

    const token = localStorage.getItem("exam_ai_token");
    const storedUser = localStorage.getItem("exam_ai_user");

    if (token && storedUser) {
      // Update backend
      await fetch("http://localhost:5000/api/auth/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ preferredExam: exam }),
      });

      // Update localStorage copy
      const user = JSON.parse(storedUser);
      user.preferredExam = exam;
      localStorage.setItem("exam_ai_user", JSON.stringify(user));
    }
  };

  return (
    <div className={styles.page}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.headerLeft} ref={headerLeftRef}>
          <button
            className={styles.backBtn}
            onClick={() => window.history.back()}
          >
            🔙 Back
          </button>

          <div className={styles.menuWrapper}>
            <button
              className={styles.menuBtn}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((s) => !s)}
            >
              ☰
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  className={styles.dropdown}
                  ref={dropdownRef}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <button
                    className={styles.dropdownItem}
                    onClick={() => setExamsOpen((s) => !s)}
                  >
                    🎯 Select Your Exam {examsOpen ? "▲" : "▼"}
                  </button>

                  <AnimatePresence>
                    {examsOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className={styles.subList}
                      >
                        {EXAMS.map((e) => (
                          <button
                            key={e}
                            className={styles.dropdownItem}
                            onClick={() => onSelectExam(e)}
                          >
                            {e}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <h1 className={styles.title}>
          {selectedExam ? `${selectedExam} Exam` : "Exam"}
        </h1>

        <div className={styles.headerRight}>
          <button
            className={styles.logoutBtn}
            onClick={() => {
              localStorage.removeItem("exam_ai_token");
              localStorage.removeItem("exam_ai_user");
              window.location.href = "/";
            }}
          >
            🔒 Logout
          </button>
        </div>
      </header>

      {/* MAIN */}
      <main className={styles.main}>
        {!selectedExam ? (
          <div className={styles.centerCardWrap}>
            <motion.div
              className={styles.chooseCard}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 160, damping: 18 }}
            >
              <h2 className={styles.chooseTitle}>✨ Choose your interest</h2>
              <p className={styles.chooseSub}>
                Select an exam from the menu or choose below to continue.
              </p>
              <div className={styles.quickList}>
                {EXAMS.map((e) => (
                  <button
                    key={e}
                    className={styles.quickBtn}
                    onClick={() => onSelectExam(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          <div
            className={styles.bentoGrid}
            role="region"
            aria-label="Exam options"
          >
            <div className={styles.leftColumn}>
              <Card
                title={`📘 Subjects + 🧠 Practice — ${selectedExam}`}
                onClick={() => (window.location.href = "/subjects")}
                className={styles.leftTall}
                />

              <div className={styles.bottomRow}>
                <Card
                  title="📚 Past Year Sets"
                  onClick={() => console.log("Past Year Sets")}
                />
                <Card
                  title="🤖 AI Insights"
                  onClick={() => console.log("AI Insights")}
                />
              </div>
            </div>
            <div className={styles.rightColumn}>
              <Card
                title="📄 Full-Length Tests"
                onClick={() => console.log("Full-Length Tests")}
                className={styles.rightTall}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
