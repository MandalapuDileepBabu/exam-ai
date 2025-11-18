// src/routes/googleOAuthRoutes.ts
import express from "express";
import { google } from "googleapis";
import fs from "fs";
import path from "path";

const router = express.Router();

// Read credentials.json
const credentials = JSON.parse(fs.readFileSync("credentials.json", "utf-8"));
const { client_id, client_secret, redirect_uris } = credentials.web;

// ✔️ Correct redirect URI
const REDIRECT_URI = "http://localhost:5000/oauth2callback";

const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  REDIRECT_URI
);

// Step 1: Generate consent URL
router.get("/auth/google", (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force refresh_token every time
    scope: ["https://www.googleapis.com/auth/drive.file"],
  });

  res.redirect(authUrl);
});

// Step 2: OAuth callback
router.get("/oauth2callback", async (req, res) => {
  const code = req.query.code as string;

  if (!code) {
    return res.status(400).send("Missing authorization code");
  }

  try {
    const { tokens } = await oAuth2Client.getToken(code);

    // Save token.json
    fs.writeFileSync(
      path.resolve("./token.json"),
      JSON.stringify(tokens, null, 2)
    );

    res.send("✅ Drive authorized! token.json saved successfully.");
  } catch (err) {
    res.status(500).send("❌ Failed to get tokens: " + err);
  }
});

export default router;
