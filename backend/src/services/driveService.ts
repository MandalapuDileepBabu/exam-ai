// src/services/driveService.ts
import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { db } from "../config/firebase";

/* -------------------------------------------------------------------------- */
/* CONSTANTS                                                                  */
/* -------------------------------------------------------------------------- */

const credentialsPath = path.resolve("./credentials.json");
const tokenPath = path.resolve("./token.json");

// Your main Exam-AI root folder
export const MAIN_FOLDER_ID = "1P8yTsEFGc1_40JG44n1BSEMMAhgiK5DY";

// Global storage for generated questions
export const GENERATED_QUESTIONS_FOLDER_ID =
  "1-gR1vMRL_rNbSX9poikncbzTpW2-S7LX";

/* -------------------------------------------------------------------------- */
/* OAuth2 Drive Client (your Gmail + token.json)                              */
/* -------------------------------------------------------------------------- */
export async function getDriveClient() {
  try {
    const credsRaw = fs.readFileSync(credentialsPath, "utf8");
    const tokenRaw = fs.readFileSync(tokenPath, "utf8");
    const credentials = JSON.parse(credsRaw);
    const token = JSON.parse(tokenRaw);

    const { client_id, client_secret, redirect_uris } = credentials.web;

    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    oAuth2Client.setCredentials(token);

    const drive = google.drive({ version: "v3", auth: oAuth2Client });
    console.log("✅ Google Drive client authenticated via OAuth2");

    return drive;
  } catch (err: any) {
    console.error("❌ Drive client creation failed:", err?.message ?? err);
    throw new Error("Google Drive authentication failed — check credentials.json/token.json");
  }
}

/* -------------------------------------------------------------------------- */
/* Helper: find or create folder                                              */
/* -------------------------------------------------------------------------- */
async function findOrCreateFolder(
  drive: any,
  parentId: string,
  folderName: string
): Promise<string> {
  try {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
      supportsAllDrives: true,
    });

    if (res.data.files?.length) return res.data.files[0].id!;

    const folder = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      },
      fields: "id",
      supportsAllDrives: true,
    });

    console.log(`📁 Created folder '${folderName}' (${folder.data.id})`);
    return folder.data.id!;
  } catch (err: any) {
    console.error(`❌ Error ensuring folder '${folderName}':`, err?.message ?? err);
    throw new Error("Failed to ensure folder structure");
  }
}

/* -------------------------------------------------------------------------- */
/* Create full per-user Drive folder structure                                */
/* -------------------------------------------------------------------------- */
export async function ensureUserDriveStructure(uid: string) {
  const drive = await getDriveClient();
  console.log(`🧩 Ensuring Drive folder structure for user: ${uid}`);

  try {
    await drive.files.get({
      fileId: MAIN_FOLDER_ID,
      fields: "id,name",
      supportsAllDrives: true,
    });
  } catch (err) {
    console.error("❌ Main folder inaccessible.", err);
    throw new Error("Drive root folder is not shared with your Gmail");
  }

  const usersFolderId = await findOrCreateFolder(drive, MAIN_FOLDER_ID, "users");
  const userFolderId = await findOrCreateFolder(drive, usersFolderId, uid);

  const profile = await findOrCreateFolder(drive, userFolderId, "profile");
  const background = await findOrCreateFolder(drive, userFolderId, "background");
  const uploads = await findOrCreateFolder(drive, userFolderId, "uploads");

  const history = await findOrCreateFolder(drive, userFolderId, "history");

  // NEW — subfolders for your two chat systems
  const mentor = await findOrCreateFolder(drive, history, "mentor");
  const study = await findOrCreateFolder(drive, history, "study");

  const aiSessions = await findOrCreateFolder(drive, userFolderId, "ai-sessions");

  // Save references (optional)
  await db.collection("users").doc(uid).set(
    {
      driveRootId: userFolderId,
      driveMainFolder: MAIN_FOLDER_ID,
      driveUsersFolder: usersFolderId,
      driveProfileFolder: profile,
      driveBackgroundFolder: background,
      driveUploadsFolder: uploads,
      driveHistoryFolder: history,
      driveMentorFolder: mentor,
      driveStudyFolder: study,
      driveAISessionsFolder: aiSessions,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return {
    root: MAIN_FOLDER_ID,
    users: usersFolderId,
    user: userFolderId,
    profile,
    background,
    uploads,
    history,
    mentor,
    study,
    aiSessions,
  };
}

/* -------------------------------------------------------------------------- */
/* Upload a buffer (used by uploads, chat, questions)                         */
/* -------------------------------------------------------------------------- */
export async function uploadBufferToDrive(
  drive: any,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  parentFolderId: string
): Promise<{ url: string; fileId: string }> {
  try {
    const stream = new Readable();
    stream.push(fileBuffer);
    stream.push(null);

    const uploaded = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [parentFolderId],
      },
      media: {
        mimeType,
        body: stream,
      },
      fields: "id",
      supportsAllDrives: true,
    });

    const fileId = uploaded.data.id!;

    // make it readable (public link)
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
      supportsAllDrives: true,
    });

    const url = `https://drive.google.com/uc?export=view&id=${fileId}`;
    return { url, fileId };
  } catch (err: any) {
    console.error("❌ Upload failed:", err?.message);
    throw new Error("Upload to Drive failed");
  }
}

/* -------------------------------------------------------------------------- */
/* Read file content (for chat append)                                        */
/* -------------------------------------------------------------------------- */
export async function getFileContent(drive: any, fileId: string): Promise<string> {
  try {
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "text" }
    );

    return typeof res.data === "string" ? res.data : "";
  } catch (err: any) {
    console.error("❌ getFileContent error:", err?.message);
    return "";
  }
}
/* ---------------------------------------------------------- */
/* Safe JSON reader for Drive                                 */
/* ---------------------------------------------------------- */
export async function readJsonFileSafe(drive: any, fileId: string) {
  try {
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "text" }
    );

    // Always ensure raw is a string
    const raw = typeof res.data === "string" ? res.data.trim() : "";

    if (!raw) return { messages: [] }; // empty

    try {
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === "object") ? parsed : { messages: [] };
    } catch (e) {
      console.warn("⚠️ JSON parse failed:", e);
      return { messages: [] }; // fallback if invalid json
    }
  } catch (err: any) {
    console.error("❌ readJsonFileSafe error:", err?.message);
    return { messages: [] };
  }
}


/* -------------------------------------------------------------------------- */
/* Create new .txt session file (kept for compatibility)                      */
/* -------------------------------------------------------------------------- */
export async function createNewTextFile(
  drive: any,
  parentFolderId: string,
  fileName: string,
  text: string
): Promise<{ fileId: string; url: string }> {
  const buffer = Buffer.from(text, "utf8");

  return await uploadBufferToDrive(
    drive,
    buffer,
    fileName,
    "text/plain",
    parentFolderId
  );
}

/* -------------------------------------------------------------------------- */
/* Create new JSON file (for sessions)                                        */
/* -------------------------------------------------------------------------- */
export async function createNewJsonFile(
  drive: any,
  parentFolderId: string,
  fileName: string,
  jsonObj: any
): Promise<{ fileId: string; url: string }> {
  const buffer = Buffer.from(JSON.stringify(jsonObj, null, 2), "utf8");
  return await uploadBufferToDrive(drive, buffer, fileName, "application/json", parentFolderId);
}

/* -------------------------------------------------------------------------- */
/* Read JSON file and parse                                                     */
/* -------------------------------------------------------------------------- */
export async function readJsonFile(drive: any, fileId: string): Promise<any | null> {
  try {
    const raw = await getFileContent(drive, fileId);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      // if file contains trailing things, attempt to salvage
      try {
        return JSON.parse(raw.trim());
      } catch (e) {
        console.warn("⚠️ readJsonFile: parse failed", e);
        return null;
      }
    }
  } catch (err: any) {
    console.error("❌ readJsonFile error:", err?.message ?? err);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Update an existing file with a JSON object (overwrite content)             */
/* -------------------------------------------------------------------------- */
export async function updateJsonFile(drive: any, fileId: string, jsonObj: any): Promise<boolean> {
  try {
    const bodyBuffer = Buffer.from(JSON.stringify(jsonObj, null, 2), "utf8");
    // Use files.update with media
    await drive.files.update({
      fileId,
      media: {
        mimeType: "application/json",
        body: bodyBuffer,
      },
      supportsAllDrives: true,
    });
    return true;
  } catch (err: any) {
    console.error("❌ updateJsonFile error:", err?.message);
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Append a message to an existing JSON session file (reads, modifies, writes) */
/* -------------------------------------------------------------------------- */
export async function appendMessageToJsonFile(
  drive: any,
  fileId: string,
  messageObj: { role: string; text: string; ts?: number }
): Promise<boolean> {
  try {
    const existing = await readJsonFile(drive, fileId);
    if (!existing) {
      // create minimal structure if file missing or corrupted
      const newObj = {
        type: "unknown",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [ { ...messageObj, ts: messageObj.ts || Date.now() } ],
      };
      // can't change parents since we only have fileId, so abort
      throw new Error("Existing JSON session not found or parseable");
    }

    if (!Array.isArray(existing.messages)) existing.messages = [];

    existing.messages.push({ ...messageObj, ts: messageObj.ts || Date.now() });
    existing.updatedAt = new Date().toISOString();

    const ok = await updateJsonFile(drive, fileId, existing);
    return ok;
  } catch (err: any) {
    console.error("❌ appendMessageToJsonFile error:", err?.message ?? err);
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Save practice questions to global folder                                   */
/* -------------------------------------------------------------------------- */
export async function saveGeneratedQuestionsFile(
  drive: any,
  text: string
): Promise<{ fileId: string; url: string }> {
  const fileName = `questions_${Date.now()}.txt`;
  return await createNewTextFile(
    drive,
    GENERATED_QUESTIONS_FOLDER_ID,
    fileName,
    text
  );
}

/* -------------------------------------------------------------------------- */
/* Test connection helper                                                     */
/* -------------------------------------------------------------------------- */
export async function testDriveConnection() {
  const drive = await getDriveClient();

  const res = await drive.files.list({
    q: `'${MAIN_FOLDER_ID}' in parents and trashed=false`,
    fields: "files(id, name, mimeType)",
    supportsAllDrives: true,
    pageSize: 10,
  });

  return res.data.files || [];
}
