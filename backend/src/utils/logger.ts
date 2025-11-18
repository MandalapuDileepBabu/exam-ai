// src/utils/logger.ts
import { db } from "../config/firebase";
import dotenv from "dotenv";
dotenv.config();

type LogEntry = {
  actorUid: string;
  action: string;
  target?: string;
  details?: Record<string, any>;
  timestamp?: string;
};

export async function logAction(entry: LogEntry) {
  const now = new Date().toISOString();

  // ✅ Hide SuperAdmin UID for security
  const maskedActorUid =
    entry.actorUid === process.env.SUPERADMIN_UID ? "SYSTEM_ROOT" : entry.actorUid;

  const payload = {
    ...entry,
    actorUid: maskedActorUid,
    timestamp: entry.timestamp || now,
  };

  // immutable append-only collection
  await db.collection("admin_actions").add(payload);

  // Optionally duplicate in a general logs collection for monitoring later
  // await db.collection("logs").add(payload);
}
