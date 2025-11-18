// src/components/ChatPopup.tsx
import React, { useEffect, useRef, useState } from "react";
import styles from "../styles/subjects.module.css";

const API = "http://localhost:5000/api";

type Props = {
  onClose: () => void;
  token: string;
  sessionId?: string | null;
};

export default function ChatPopup({
  onClose,
  token,
  sessionId: incomingSessionId = null,
}: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const listRef = useRef<HTMLDivElement | null>(null);

  const [position, setPosition] = useState(() => ({
    x: Math.max(12, window.innerWidth - 380 - 50),
    y: Math.max(12, window.innerHeight - 480 - 80),
  }));

  const [sessionId, setSessionId] = useState<string | null>(
    incomingSessionId
  );

  const [messages, setMessages] = useState<
    { id: string; role: "user" | "assistant"; text: string }[]
  >([{ id: "welcome", role: "assistant", text: "Hey! What's up?" }]);

  const [input, setInput] = useState("");

  /* -------------------------------------------------------
     LOAD JSON SESSION
  ------------------------------------------------------- */
  useEffect(() => {
    if (!incomingSessionId || !token) return;

    (async () => {
      try {
        const r = await fetch(
          `${API}/history/mentor/session/${incomingSessionId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const data = await r.json();
        if (!data.ok || !data.session) return;

        const msgs = Array.isArray(data.session.messages)
          ? data.session.messages
          : [];

        const parsed = msgs.map((msg: any, i: number) => ({
          id: "m" + i,
          role: msg.role,
          text: msg.text,
        }));

        setMessages(parsed);
        setSessionId(incomingSessionId);
      } catch (e) {
        console.error("load session error:", e);
      }
    })();
  }, [incomingSessionId, token]);

  /* -------------------------------------------------------
     SEND MESSAGE
  ------------------------------------------------------- */
  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;

    const uid = "u" + Date.now();
    const aid = "a" + Date.now();

    setMessages((m) => [...m, { id: uid, role: "user", text }]);
    setMessages((m) => [...m, { id: aid, role: "assistant", text: "…" }]);
    setInput("");

    try {
      const r = await fetch(`${API}/ai/mentor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          sessionId,
        }),
      });

      const data = await r.json();
      const reply = data.reply || "…";

      if (data.sessionId) setSessionId(data.sessionId);

      setMessages((m) =>
        m.map((x) => (x.id === aid ? { ...x, text: reply } : x))
      );
    } catch (e) {
      console.error("send error:", e);
    }
  };

  /* -------------------------------------------------------
     DRAG LOGIC (unchanged)
  ------------------------------------------------------- */
  const clampAndSet = (nx: number, ny: number) => {
    const margin = 8;
    const pw = panelRef.current?.clientWidth ?? 360;
    const ph = panelRef.current?.clientHeight ?? 460;

    setPosition({
      x: Math.max(margin, Math.min(window.innerWidth - pw - margin, nx)),
      y: Math.max(margin, Math.min(window.innerHeight - ph - margin, ny)),
    });
  };

  const startDrag = (e: any) => {
    const rect = panelRef.current?.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;

    offsetRef.current = rect
      ? { x: cx - rect.left, y: cy - rect.top }
      : { x: 0, y: 0 };

    dragRef.current = true;
  };

  useEffect(() => {
    const move = (e: any) => {
      if (!dragRef.current) return;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      clampAndSet(cx - offsetRef.current.x, cy - offsetRef.current.y);
    };

    const stop = () => (dragRef.current = false);

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", move);
    window.addEventListener("touchend", stop);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", stop);
    };
  }, []);

  /* -------------------------------------------------------
     AUTO SCROLL
  ------------------------------------------------------- */
  useEffect(() => {
    if (listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  /* -------------------------------------------------------
     UI
  ------------------------------------------------------- */
  return (
    <div
      ref={panelRef}
      className={styles.chatPopupPanel}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div
        className={styles.chatPopupHeader}
        onMouseDown={startDrag}
        onTouchStart={startDrag}
      >
        <span>Mentor Chat</span>
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>

      <div ref={listRef} className={styles.chatPopupMessages}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? styles.chatBubbleUser
                : styles.chatBubbleAI
            }
          >
            {m.text}
          </div>
        ))}
      </div>

      <div className={styles.chatPopupInputRow}>
        <input
          className={styles.chatPopupInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Say something..."
        />
        <button className={styles.chatPopupSendBtn} onClick={sendMessage}>
          ➤
        </button>
      </div>
    </div>
  );
}
