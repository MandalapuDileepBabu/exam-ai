import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "path";
dotenv.config();

const serviceAccountPath = path.resolve(__dirname, "serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath)),
  storageBucket: process.env.GCS_BUCKET_NAME || "newcivic-a44c4.appspot.com",
});

export const db = admin.firestore();
export const auth = admin.auth();
export const bucket = admin.storage().bucket();

console.log("✅ Firebase Admin initialized successfully");
