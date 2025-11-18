// src/config/gcs.ts
import { Storage } from "@google-cloud/storage";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const keyPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS || "src/config/serviceAccountKey.json");

const storage = new Storage({
  keyFilename: keyPath,
});

export const bucketName = process.env.GCS_BUCKET_NAME || "newcivic-a44c4.appspot.com";
export const bucket = storage.bucket(bucketName);

console.log(`✅ GCS initialized. Bucket: ${bucketName}`);
