import { getDriveClient } from "../services/driveService";

(async () => {
  try {
    const drive = await getDriveClient();
    console.log("✅ Drive client initialized successfully!");

    const result = await drive.files.list({
      pageSize: 5,
      fields: "files(id, name)",
    });

    console.log("📂 Example files:");
    console.table(result.data.files || []);
  } catch (err) {
    console.error("❌ Drive connection test failed:", err);
  }
})();
