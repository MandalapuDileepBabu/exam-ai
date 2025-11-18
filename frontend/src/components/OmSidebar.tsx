// src/components/OmSidebar.tsx
import React, { useEffect, useState } from "react";
import styles from "../styles/sidebar.module.css";

type Session = {
  id: string;
  title: string;
  createdAt: string;
};

type Props = {
  token: string;
  onLoadSession: (sessionId: string, type: "mentor" | "subject") => void;
  open: boolean;          // Controls if sidebar is open
  onClose: () => void;    // Callback to close sidebar
};

export default function OmSidebar({ token, onLoadSession, open, onClose }: Props) {
  const [mentorSessions, setMentorSessions] = useState<Session[]>([]);
  const [subjectSessions, setSubjectSessions] = useState<Session[]>([]);

  const [mentorOpen, setMentorOpen] = useState(true);
  const [subjectOpen, setSubjectOpen] = useState(true);

  useEffect(() => {
    if (!open || !token) return;

    (async () => {
      try {
        const r1 = await fetch("http://localhost:5000/api/history/mentor", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d1 = await r1.json();
        if (d1.ok) setMentorSessions(d1.sessions);

        const r2 = await fetch("http://localhost:5000/api/history/subject", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d2 = await r2.json();
        if (d2.ok) setSubjectSessions(d2.sessions);
      } catch (err) {
        console.error("Sidebar history fetch error:", err);
      }
    })();
  }, [open, token]);

  return (
    <div className={`${styles.sidebar} ${open ? styles.show : ""}`}>
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarTitle}>History</div>
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>

      {/* Mentor Sessions */}
      <div className={styles.section}>
        <div
          className={styles.sectionHeader}
          onClick={() => setMentorOpen(!mentorOpen)}
        >
          <span>🧘 Mentor Sessions</span>
          <span>{mentorOpen ? "▲" : "▼"}</span>
        </div>

        {mentorOpen && (
          <div className={styles.sessionList}>
            {mentorSessions.length === 0 ? (
              <div className={styles.empty}>No sessions</div>
            ) : (
              mentorSessions.map((s) => (
                <div
                  key={s.id}
                  className={styles.sessionItem}
                  onClick={() => onLoadSession(s.id, "mentor")}
                >
                  {s.title}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Study Sessions */}
      <div className={styles.section}>
        <div
          className={styles.sectionHeader}
          onClick={() => setSubjectOpen(!subjectOpen)}
        >
          <span>📘 Study Sessions</span>
          <span>{subjectOpen ? "▲" : "▼"}</span>
        </div>

        {subjectOpen && (
          <div className={styles.sessionList}>
            {subjectSessions.length === 0 ? (
              <div className={styles.empty}>No sessions</div>
            ) : (
              subjectSessions.map((s) => (
                <div
                  key={s.id}
                  className={styles.sessionItem}
                  onClick={() => onLoadSession(s.id, "subject")}
                >
                  {s.title}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
