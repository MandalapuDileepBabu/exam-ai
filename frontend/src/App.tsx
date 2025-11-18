import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";

import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import ExamPage from "./pages/ExamPage";
import ProfilePage from "./pages/ProfilePage";
import SubjectsPractice from "./pages/SubjectsPractice"; // ⭐ NEW PAGE IMPORT

import "./styles/theme.css";

const Navbar: React.FC = () => {
  const location = useLocation();

  // Hide navbar on core screens
  const hiddenRoutes = [
    "/",
    "/register",
    "/dashboard",
    "/exam",
    "/profile",
    "/subjects", // ⭐ NEW — hides navbar in subjects page
  ];

  if (hiddenRoutes.includes(location.pathname)) return null;

  return (
    <nav className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-10">
      <h1 className="text-2xl font-extrabold text-[#1E3A8A] tracking-wide">
        Exam-AI
      </h1>
    </nav>
  );
};

const Footer: React.FC = () => {
  const location = useLocation();

  // Hide footer on core screens
  const hiddenRoutes = [
    "/",
    "/register",
    "/dashboard",
    "/exam",
    "/profile",
    "/subjects", // ⭐ NEW — hides footer
  ];

  if (hiddenRoutes.includes(location.pathname)) return null;

  return (
    <footer className="bg-white py-4 text-center text-sm text-gray-500 border-t border-gray-200">
      © {new Date().getFullYear()} Exam-AI — All rights reserved.
    </footer>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen w-full overflow-x-hidden bg-[#0f172a]">
        <Navbar />

        <main className="relative w-full h-full">
          <Routes>
            {/* Auth Pages */}
            <Route path="/" element={<AuthPage />} />
            <Route path="/register" element={<AuthPage />} />

            {/* Main App Pages */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/exam" element={<ExamPage />} />
            <Route path="/profile" element={<ProfilePage />} />

            {/* ⭐ NEW — Subjects + Practice */}
            <Route path="/subjects" element={<SubjectsPractice />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  );
};

export default App;
