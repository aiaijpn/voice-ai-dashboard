"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

/**
 * Google Sheets 書き込みテスト（FILE方式）
 *
 * 目的
 * - service account 認証OKか
 * - spreadsheetId 到達OKか
 * - conversation_history に append できるか
 */

const SHEET_NAME = "conversation_history";

function getServiceAccountFromFile() {
  const rawPath = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

  if (!rawPath) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_FILE is required");
  }

  const resolved = path.resolve(process.cwd(), rawPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`service account file not found: ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, "utf8");
  return JSON.parse(raw);
}

function createSheetsClient() {
  const credentials = getServiceAccountFromFile();

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({
    version: "v4",
    auth,
  });
}

async function main() {
  console.log("=================================");
  console.log("Sheet Append Test");
  console.log("=================================");

  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID is required");
  }

  const sheets = createSheetsClient();

  const now = new Date().toISOString();

  const row = [
    now,
    "TEST_BOT",
    "TEST_USER",
    "append test message",
    "append test reply",
    "memo",
    false,
    "test_script",
    false,
  ];

  console.log("append row:", row);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row],
    },
  });

  console.log("\n✅ append success");
  console.log("sheet:", SHEET_NAME);
}

main().catch((err) => {
  console.error("\n❌ append failed");
  console.error(err.message);
});