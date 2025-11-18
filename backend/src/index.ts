import dotenv from "dotenv";
import app from "./app";
import admin from "firebase-admin";
import path from "path";

dotenv.config();

// ✅ Initialize Firebase Admin SDK once
if (!admin.apps.length) {
  try {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "src/config/serviceAccountKey.json";

    admin.initializeApp({
      credential: admin.credential.cert(path.resolve(serviceAccountPath)),
    });

    console.log("✅ Firebase Admin initialized successfully");
  } catch (error) {
    console.error("❌ Firebase initialization failed:", error);
  }
}

// ✅ Start Express server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Exam-AI backend running on port ${PORT}`);
});
