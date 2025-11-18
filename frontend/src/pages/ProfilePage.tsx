import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/Profile.module.css";

const API_BASE_URL = "http://localhost:5000/api";

const ProfilePage: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [pfPreview, setPfPreview] = useState<string | null>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const navigate = useNavigate();

  const token = localStorage.getItem("exam_ai_token");

const fetchDriveImage = (url: string | null | undefined): string => {
  if (!url) return "";

  // already in correct format
  if (url.includes("uc?export=view&id=")) return url;

  // convert /file/d/ links
  if (url.includes("drive.google.com/file/d/")) {
    const match = url.match(/\/d\/([^/]+)/);
    const fileId = match ? match[1] : null;
    if (fileId) return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  // convert old uc?id links
  if (url.includes("uc?id=")) {
    const id = url.split("id=")[1];
    return `https://drive.google.com/uc?export=view&id=${id}`;
  }

  return url;
};


  // ✅ Fetch user info
  useEffect(() => {
    if (!token) return navigate("/", { replace: true });

    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (res.ok && data.user) {
          // 🧠 Fix any Drive URLs automatically
          if (data.user.photoURL)
            data.user.photoURL = fetchDriveImage(data.user.photoURL);
          if (data.user.backgroundURL)
            data.user.backgroundURL = fetchDriveImage(data.user.backgroundURL);

          setUser(data.user);
          setAchievements(
            data.user.achievements || [{ title: "Consistency Star", icon: "🏅" }]
          );
        } else navigate("/", { replace: true });
      } catch {
        navigate("/", { replace: true });
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [navigate, token]);

  // ✅ Clean blob URLs on unmount
  useEffect(() => {
    return () => {
      if (pfPreview) URL.revokeObjectURL(pfPreview);
      if (bgPreview) URL.revokeObjectURL(bgPreview);
    };
  }, [pfPreview, bgPreview]);

  if (loading)
    return (
      <div className={styles.loading}>
        <p className={styles.loadingText}>Loading your profile...</p>
      </div>
    );

  const handleEditToggle = () => setIsEditing((s) => !s);

  // ✅ Background upload handler (fixed blob + Drive link)
  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditing) return alert("Please enter edit mode before uploading.");
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setBgPreview(previewUrl);

    try {
      const uploadedUrl = await uploadToDrive(file, "background");
      const driveUrl = fetchDriveImage(uploadedUrl);

      setUser((prev: any) => ({ ...prev, backgroundURL: driveUrl }));

      setTimeout(() => {
        URL.revokeObjectURL(previewUrl);
        setBgPreview(null);
      }, 1000);

      console.log("✅ Background uploaded:", driveUrl);
      alert("✅ Background image uploaded successfully!");
    } catch (err) {
      console.error("❌ Background upload failed:", err);
      alert("❌ Failed to upload background image.");
    }
  };

  // ✅ Profile picture upload handler (fixed blob + Drive link)
  const handlePfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditing) return alert("Please enter edit mode before uploading.");
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setPfPreview(previewUrl);

    try {
      const uploadedUrl = await uploadToDrive(file, "profile");
      const driveUrl = fetchDriveImage(uploadedUrl);

      setUser((prev: any) => ({ ...prev, photoURL: driveUrl }));

      setTimeout(() => {
        URL.revokeObjectURL(previewUrl);
        setPfPreview(null);
      }, 1000);

      console.log("✅ Profile uploaded:", driveUrl);
      alert("✅ Profile picture uploaded successfully!");
    } catch (err) {
      console.error("❌ Profile upload failed:", err);
      alert("❌ Failed to upload profile picture.");
    }
  };

  // ✅ Field change handler
  const handleFieldChange = (key: string, value: string) => {
    setUser((prev: any) => ({ ...prev, [key]: value }));
  };

  // ✅ Save updated profile (fixed to avoid local blob URLs)
  const handleSave = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
        fullName: user.fullName,
        phone: user.phone,
        description: user.description,
        location: user.location,
        photoURL: user.photoURL ? fetchDriveImage(user.photoURL) : undefined,
        backgroundURL: fetchDriveImage(user.backgroundURL),
        achievements,
      }),

      });

      const data = await res.json();
      if (res.ok) {
        alert("✅ Profile updated successfully!");
        setIsEditing(false);
      } else {
        alert("❌ Failed to update profile: " + (data.message || "unknown"));
      }
    } catch (err) {
      alert("⚠️ Error updating profile");
      console.error(err);
    }
  };

  // ✅ Remove background image
  const handleRemoveBackground = async () => {
    setBgPreview(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ backgroundURL: "" }),
      });
      if (res.ok) {
        setUser((prev: any) => ({ ...prev, backgroundURL: "" }));
        alert("✅ Background removed (reverted to default).");
      } else {
        const d = await res.json();
        console.warn("remove background error:", d);
        alert("❌ Couldn't remove background.");
      }
    } catch (err) {
      console.error(err);
      alert("⚠️ Error removing background.");
    }
  };

  // ✅ Logout handler
  const handleLogout = () => {
    localStorage.removeItem("exam_ai_token");
    navigate("/", { replace: true });
  };

  // ✅ Add new achievement
  const handleAddAchievement = () => {
    if (!isEditing) return alert("Enter edit mode to add achievements.");
    const title = prompt("🏆 Enter achievement title:");
    if (title)
      setAchievements((prev) => [
        ...prev,
        { title, icon: "🏅", dateEarned: new Date().toISOString() },
      ]);
  };

  // ✅ Background style logic
  const defaultGradient =
    "linear-gradient(135deg, #0f172a 0%, #1e3a8a 45%, #0d9488 100%)";
  const backgroundStyle = bgPreview
    ? { backgroundImage: `url(${bgPreview})` }
    : user?.backgroundURL
    ? { backgroundImage: `url(${fetchDriveImage(user.backgroundURL)})` }
    : { background: defaultGradient };

  const profileImage =
    pfPreview ||
    fetchDriveImage(user?.photoURL) ||
    "https://cdn-icons-png.flaticon.com/512/847/847969.png";  

  return (
    <div
      className={styles.profilePage}
      style={{
        ...backgroundStyle,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Hidden inputs */}
      <input
        id="bgUpload"
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={handleBgUpload}
      />
      <input
        id="pfUpload"
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={handlePfUpload}
      />

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.leftSection}>
          <button
            className={styles.backBtn}
            onClick={() => navigate("/dashboard")}
          >
            ← Back
          </button>
        </div>

        <h1 className={styles.title}>Profile</h1>

        <div className={styles.headerActions}>
          <button
            className={styles.backBtn}
            onClick={() =>
              isEditing
                ? document.getElementById("bgUpload")?.click()
                : alert("Enter edit mode to change background.")
            }
          >
            Change Background
          </button>

          <button className={styles.backBtn} onClick={handleRemoveBackground}>
            Remove Background
          </button>

          <button className={styles.logoutBtn} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className={styles.main}>
        <div className={styles.profileCard}>
          {/* Profile Image */}
          <div
            className={styles.profileImageContainer}
            onClick={() =>
              isEditing && document.getElementById("pfUpload")?.click()
            }
          >
            <img
              src={profileImage}
              alt="Profile"
              className={styles.profileImage}
              onError={(e) =>
                ((e.target as HTMLImageElement).src =
                  "https://cdn-icons-png.flaticon.com/512/847/847969.png")
              }
            />
          </div>

          {/* Description */}
          {isEditing ? (
            <textarea
              className={styles.editInput}
              value={user?.description || ""}
              placeholder="Add your short bio..."
              onChange={(e) =>
                handleFieldChange("description", e.target.value)
              }
            />
          ) : (
            <p className={styles.description}>
              {user?.description || "No description added yet."}
            </p>
          )}

          {/* Info section */}
          <div className={styles.infoSection}>
            <div className={styles.infoRow}>
              <span className={styles.label}>Full Name:</span>
              {isEditing ? (
                <input
                  className={styles.editInput}
                  value={user?.fullName || ""}
                  onChange={(e) =>
                    handleFieldChange("fullName", e.target.value)
                  }
                />
              ) : (
                <span className={styles.value}>
                  {user?.fullName || "User"}
                </span>
              )}
            </div>

            <div className={styles.infoRow}>
              <span className={styles.label}>Email:</span>
              <span className={styles.value}>{user?.email}</span>
            </div>

            <div className={styles.infoRow}>
              <span className={styles.label}>Phone:</span>
              {isEditing ? (
                <input
                  className={styles.editInput}
                  value={user?.phone || ""}
                  onChange={(e) =>
                    handleFieldChange("phone", e.target.value)
                  }
                />
              ) : (
                <span className={styles.value}>
                  {user?.phone || "Not added"}
                </span>
              )}
            </div>

            <div className={styles.infoRow}>
              <span className={styles.label}>Location:</span>
              {isEditing ? (
                <input
                  className={styles.editInput}
                  value={user?.location || ""}
                  onChange={(e) =>
                    handleFieldChange("location", e.target.value)
                  }
                />
              ) : (
                <span className={styles.value}>
                  {user?.location || "Unknown"}
                </span>
              )}
            </div>

            <div className={styles.infoRow}>
              <span className={styles.label}>Joined:</span>
              <span className={styles.value}>
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString()
                  : "Unknown"}
              </span>
            </div>

            <div className={styles.infoRow}>
              <span className={styles.label}>Exams Attempted:</span>
              <span className={styles.value}>{user?.examCount || 0}</span>
            </div>

            <div className={styles.infoRow}>
              <span className={styles.label}>Accuracy:</span>
              <span className={styles.value}>
                {user?.accuracy ? `${user.accuracy}%` : "N/A"}
              </span>
            </div>
          </div>

          {/* Achievements */}
          <div className={styles.achievements}>
            <h3>🏆 Achievements</h3>
            <ul className={styles.badgeList}>
              {achievements.map((a, i) => (
                <li key={i} className={styles.badge}>
                  {a.icon || "🏅"} {a.title}
                </li>
              ))}
            </ul>
            {isEditing && (
              <button
                className={styles.addBadgeBtn}
                onClick={handleAddAchievement}
              >
                + Add Achievement
              </button>
            )}
          </div>

          {/* Actions */}
          <div className={styles.actionButtons}>
            {isEditing ? (
              <>
                <button className={styles.saveBtn} onClick={handleSave}>
                  Save
                </button>
                <button
                  className={styles.cancelBtn}
                  onClick={handleEditToggle}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  className={styles.editProfileBtn}
                  onClick={handleEditToggle}
                >
                  Edit Profile
                </button>
                <button
                  className={styles.changePasswordBtn}
                  onClick={() =>
                    alert("Change Password coming soon!")
                  }
                >
                  Change Password
                </button>
              </>
            )}
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        © {new Date().getFullYear()} Exam-AI — All rights reserved.
      </footer>
    </div>
  );
};

// ✅ Helper function to upload images to Drive via backend
// ✅ Upload file to backend → Google Drive → return Drive URL
const uploadToDrive = async (file: File, type: "profile" | "background") => {
  const token = localStorage.getItem("exam_ai_token"); // ✅ must match backend JWT
  if (!token) {
    throw new Error("❌ Missing authentication token. Please log in again.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const endpoint =
    type === "profile"
      ? `${API_BASE_URL}/upload/profile`
      : `${API_BASE_URL}/upload/background`;

  try {
    console.log("📤 Uploading to:", endpoint);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`, // ✅ backend uses verifyJWT
      },
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("❌ Upload error response:", data);
      throw new Error(data.message || "Upload failed.");
    }

    if (!data.fileUrl || !data.fileUrl.includes("drive.google.com")) {
      console.warn("⚠️ Unexpected upload URL:", data.fileUrl);
    }

    console.log("✅ Uploaded successfully to Drive:", data.fileUrl);
    return data.fileUrl; // ✅ return actual Drive link
  } catch (err: any) {
    console.error("❌ uploadToDrive failed:", err.message);
    throw new Error("Failed to upload file: " + err.message);
  }
};



export default ProfilePage;
