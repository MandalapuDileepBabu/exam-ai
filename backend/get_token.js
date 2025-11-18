// get_token.js
const { google } = require("googleapis");
const readline = require("readline");
const fs = require("fs");

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const credentials = JSON.parse(fs.readFileSync("credentials.json", "utf8"));
const { client_secret, client_id, redirect_uris } = credentials.web;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

const authUrl = oAuth2Client.generateAuthUrl({ access_type: "offline", scope: SCOPES });
console.log("\nAuthorize this app by visiting this URL:\n", authUrl);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("\nEnter the code from that page here: ", async (code) => {
  const { tokens } = await oAuth2Client.getToken(code.trim());
  fs.writeFileSync("token.json", JSON.stringify(tokens, null, 2));
  console.log("\n✅ Token stored to token.json");
  rl.close();
});
