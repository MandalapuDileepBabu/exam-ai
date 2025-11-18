import { google } from "googleapis";
import fs from "fs";
import http from "http";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const TOKEN_PATH = "token.json";

export async function getDriveClient() {
  const credentials = JSON.parse(fs.readFileSync("credentials.json", "utf8"));
  const { client_secret, client_id, redirect_uris } = credentials.web;

  // Use your registered redirect URI (http://localhost:5080)
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0] || "http://localhost:5080"
  );

  // If token already exists, use it directly
  if (fs.existsSync(TOKEN_PATH)) {
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8")));
    console.log("✅ Loaded existing token from", TOKEN_PATH);
    return google.drive({ version: "v3", auth: oAuth2Client });
  }

  // Generate the auth URL for manual sign-in
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("\n🔗 Authorize this app by visiting this URL:\n", authUrl, "\n");

  // Start a local server to capture the authorization code
  const server = http.createServer(async (req, res) => {
    if (!req.url) return;

    const url = new URL(req.url, "http://localhost:5080");
    const code = url.searchParams.get("code");

    if (!code) {
      res.end("❌ No authorization code found.");
      return;
    }

    try {
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      console.log("✅ Token saved to", TOKEN_PATH);

      res.end("✅ Authorization successful! You can close this tab now.");
      server.close();
    } catch (err) {
      console.error("❌ Error retrieving tokens:", err);
      res.end("❌ Authorization failed.");
    }
  });

  // Listen on the same port as your redirect URI
  server.listen(5080, () => {
    console.log("🌐 Waiting for authorization on http://localhost:5080 ...");
  });

  return google.drive({ version: "v3", auth: oAuth2Client });
}