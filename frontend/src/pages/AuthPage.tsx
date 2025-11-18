import React, { useState, useEffect } from "react";
import { FcGoogle } from "react-icons/fc";
import { motion, AnimatePresence } from "framer-motion";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, provider } from "../firebaseConfig";
import styles from "../styles/AuthPage.module.css";

const API_BASE_URL = "http://localhost:5000/api";

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate(); // ✅ Correctly at top level
  const location = useLocation();

  // ✅ Handle page mode toggle
  useEffect(() => {
    setIsLogin(location.pathname !== "/register");
  }, [location.pathname]);

  // ✅ Auto-redirect if already logged in
  useEffect(() => {
    const verifyJWT = async () => {
      const token = localStorage.getItem("exam_ai_token");
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (res.ok && data.user) navigate("/dashboard");
        else localStorage.removeItem("exam_ai_token");
      } catch {
        localStorage.removeItem("exam_ai_token");
      } finally {
        setLoading(false);
      }
    };

    verifyJWT();
  }, [navigate]);

  // ✅ Email/Password handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    try {
      if (isLogin) {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await userCred.user.getIdToken();

        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });

        const data = await res.json();
        if (res.ok && data.token) {
          localStorage.setItem("exam_ai_token", data.token);
          setMessage("✅ Logged in successfully!");
          navigate("/dashboard");
        } else {
          setMessage(`❌ ${data.message}`);
        }
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const idToken = await userCred.user.getIdToken();

        const res = await fetch(`${API_BASE_URL}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken,
            fullName,
            email,
            password,
            role: "user",
          }),
        });

        const data = await res.json();
        if (res.ok && data.token) {
          localStorage.setItem("exam_ai_token", data.token);
          setMessage("🎉 Registered successfully!");
          navigate("/dashboard");
        } else {
          setMessage(`❌ ${data.message}`);
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      setMessage("❌ Authentication failed. Please check your credentials.");
    }
  };

  // ✅ Google Sign-In
  const handleGoogleAuth = async () => {
    try {
      console.log("▶️ starting Google popup...");
      const result = await signInWithPopup(auth, provider);
      console.log("▶️ popup result:", result);

      const idToken = await result.user.getIdToken();
      console.log("▶️ got firebase idToken (short-lived)");

      const res = await fetch(`${API_BASE_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: idToken }),
      });

      const data = await res.json();
      console.log("▶️ backend response:", res.status, data);

      if (!res.ok) throw new Error(data.message || "Backend login failed");

      // ✅ Save backend token
      localStorage.setItem("exam_ai_token", data.token);
      localStorage.setItem("exam_ai_user", JSON.stringify(data.user));
      console.log("✅ Token stored");

      console.log("🔁 Navigating to /dashboard");
      navigate("/dashboard", { replace: true });

      // ✅ Fallback (hard redirect if navigate fails)
      setTimeout(() => {
        if (window.location.pathname !== "/dashboard") {
          console.warn("⚠️ navigate() failed, forcing redirect");
          window.location.href = "/dashboard";
        } else {
          console.log("✅ Redirect successful");
        }
      }, 200);
    } catch (err: any) {
      console.error("❌ Google login failed:", err);
      alert(err.message || "Google login error");
    }
  };

  return (
    <div className={styles.authContainer}>
      <header className={styles.header}>
        <div className={styles.logo}>Exam-AI</div>
      </header>

      <main className={styles.mainContent}>
        <motion.div
          className={styles.authBox}
          layout
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <motion.div
            className={styles.leftPanel}
            layout
            transition={{ duration: 0.8, ease: "easeInOut" }}
            style={{ order: isLogin ? 1 : 2 }}
          >
            <h2 className={styles.welcomeTitle}>Welcome Back!</h2>
            <p className={styles.welcomeText}>
              Login to continue your preparation journey and stay ahead of the competition.
            </p>
          </motion.div>

          <motion.div
            className={styles.rightPanel}
            layout
            transition={{ duration: 0.8, ease: "easeInOut" }}
            style={{ order: isLogin ? 2 : 1 }}
          >
            <div className={styles.formContainer}>
              <h3 className={styles.formTitle}>
                {isLogin ? "Sign in to your account" : "Create an account"}
              </h3>

              <form onSubmit={handleSubmit} className={styles.form}>
                <AnimatePresence mode="wait">
                  {!isLogin && (
                    <motion.input
                      key="nameInput"
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: "auto", marginBottom: "1rem" }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.4, ease: "easeInOut" }}
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Name"
                      className={styles.nameInput}
                      required
                    />
                  )}
                </AnimatePresence>

                <div className={styles.inputRow}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className={styles.input}
                    required
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className={styles.input}
                    required
                  />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  className={styles.googleButton}
                >
                  <FcGoogle className={styles.googleIcon} />
                  <span>Continue with Google</span>
                </button>

                <button type="submit" className={styles.submitButton}>
                  {isLogin ? "LOGIN" : "SIGN UP"}
                </button>
              </form>

              <p className={styles.toggleText}>
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <span
                  onClick={() => setIsLogin(!isLogin)}
                  className={styles.toggleLink}
                >
                  {isLogin ? "Register" : "Login"}
                </span>
              </p>

              {message && (
                <p
                  className={`${styles.message} ${
                    message.includes("✅") || message.includes("🎉")
                      ? styles.messageSuccess
                      : styles.messageError
                  }`}
                >
                  {message}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
};

export default AuthPage;
