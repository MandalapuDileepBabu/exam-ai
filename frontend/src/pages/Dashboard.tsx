import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiMenu,
  FiHome,
  FiBookOpen,
  FiBarChart2,
  FiUser,
  FiSettings,
  FiLogOut,
} from "react-icons/fi";
import styles from "../styles/Dashboard.module.css";

const API_BASE_URL = "http://localhost:5000/api";

const Dashboard: React.FC = () => {
  const [user, setUser] = useState<any>(() => {
    const cached = localStorage.getItem("exam_ai_user");
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const fetchUser = async () => {
      const token = localStorage.getItem("exam_ai_token");
      if (!token) {
        setLoading(false);
        return navigate("/", { replace: true });
      }

      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (res.ok && data.user) {
          if (isMounted) {
            setUser(data.user);
            localStorage.setItem("exam_ai_user", JSON.stringify(data.user));
          }
        } else {
          if (isMounted) {
            localStorage.removeItem("exam_ai_token");
            localStorage.removeItem("exam_ai_user");
            navigate("/", { replace: true });
          }
        }
      } catch (err) {
        console.error("Error verifying token:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchUser();

    const handleClickOutside = (e: MouseEvent) => {
      const sidebar = document.querySelector(`.${styles.sidebar}`);
      const menuBtn = document.querySelector(`.${styles["menu-btn"]}`);
      if (
        sidebarOpen &&
        sidebar &&
        !sidebar.contains(e.target as Node) &&
        !menuBtn?.contains(e.target as Node)
      ) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      isMounted = false;
      document.removeEventListener("click", handleClickOutside);
    };
  }, [navigate, sidebarOpen]);

  const handleLogout = () => {
    localStorage.removeItem("exam_ai_token");
    localStorage.removeItem("exam_ai_user");
    navigate("/", { replace: true });
  };

  if (loading)
    return (
      <div className={styles["dashboard-page"]}>
        <main className={styles["dashboard-main"]}>
          <div className={styles["dashboard-card"]}>
            <p style={{ color: "#1e3a8a", fontWeight: 600 }}>
              Loading your dashboard...
            </p>
          </div>
        </main>
      </div>
    );

  return (
    <div className={styles["dashboard-wrapper"]}>
      {/* === Sidebar === */}
      <aside
        className={`${styles.sidebar} ${sidebarOpen ? styles.open : ""}`}
      >
        <ul className={styles.menuList}>
          <li className={styles.menuItem} onClick={() => navigate("/dashboard")}>
            <FiHome /> Home
          </li>
          <li
  className={styles.menuItem}
  onClick={() => navigate("/exam")}
>
  <FiBookOpen /> Exams
</li>
          <li className={styles.menuItem}>
            <FiBarChart2 /> Analytics
          </li>
          <li className={styles.menuItem} onClick={() => navigate("/profile")}>
            <FiUser /> Profile
          </li>
          <li className={styles.menuItem}>
            <FiSettings /> Settings
          </li>
          <li
            className={`${styles.menuItem} ${styles.logout}`}
            onClick={handleLogout}
          >
            <FiLogOut /> Logout
          </li>
        </ul>
      </aside>

      {/* === Main Section === */}
      <div className={styles["dashboard-page"]}>
        {/* Header */}
        <header className={styles["dashboard-header"]}>
          <div className={styles["header-left"]}>
            <button
              className={styles["menu-btn"]}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <FiMenu />
            </button>
            <h1 className={styles["dashboard-title"]}>Dashboard</h1>
          </div>

          {/* Profile Icon */}
          <div
            className={styles["profile-section"]}
            onClick={() => navigate("/profile")}
          >
            <FiUser className={styles["profile-icon"]} title="Profile" />
          </div>
        </header>

        {/* Main Content */}
        <main className={styles["dashboard-main"]}>
          <div className={styles["dashboard-card"]}>
            {user ? (
              <>
                <h2 className={styles["dashboard-welcome"]}>
                  👋 Welcome, {user.fullName || "User"}!
                </h2>
                <p className={styles["dashboard-subtext"]}>
                  You’re now ready to explore Exam-AI. Stay consistent, study
                  smart, and track your progress as you move closer to your
                  goals.
                </p>
              </>
            ) : (
              <p className={styles["dashboard-subtext"]}>
                User information not available.
              </p>
            )}
          </div>
        </main>

        <footer className={styles["dashboard-footer"]}>
          © {new Date().getFullYear()} Exam-AI — All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default Dashboard;
