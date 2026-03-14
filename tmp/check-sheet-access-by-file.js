"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

/**
 * FILE方式で Google Sheets へ到達できるか確認する単独テスト
 *
 * 確認すること:
 * 1. GOOGLE_SERVICE_ACCOUNT_FILE があるか
 * 2. ファイルが存在するか
 * 3. JSONとして読めるか
 * 4. Sheets client が作れるか
 * 5. SPREADSHEET_ID に到達できるか
 * 6. conversation_history シートが存在するか
 */

const SHEET_NAME = "conversation_history";

function getServiceAccountFromFile() {
  const rawPath = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

  if (!rawPath) {
    throw new Error(
      "tmp/check-sheet-access-by-file: GOOGLE_SERVICE_ACCOUNT_FILE is required"
    );
  }

  const resolvedPath = path.resolve(process.cwd(), rawPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `tmp/check-sheet-access-by-file: file not found: ${resolvedPath}`
    );
  }

  const raw = fs.readFileSync(resolvedPath, "utf8");
  return JSON.parse(raw);
}

function createSheetsClientFromFile() {
  const serviceAccount = getServiceAccountFromFile();

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({
    version: "v4",
    auth,
  });
}

async function main() {
  console.log("=================================");
  console.log("Sheet Access Check By File");
  console.log("=================================");

  const spreadsheetId = String(process.env.SPREADSHEET_ID || "").trim();

  if (!spreadsheetId) {
    console.log({
      success: false,
      message: "SPREADSHEET_ID is required",
      data: null,
    });
    process.exit(1);
  }

  console.log("serviceAccountFile:", process.env.GOOGLE_SERVICE_ACCOUNT_FILE);
  console.log("spreadsheetId     :", spreadsheetId);
  console.log("sheetName         :", SHEET_NAME);

  try {
    const sheets = createSheetsClientFromFile();

    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const spreadsheetTitle =
      response?.data?.properties?.title || "(unknown spreadsheet title)";

    const sheetTitles = Array.isArray(response?.data?.sheets)
      ? response.data.sheets.map((sheet) => sheet?.properties?.title || "")
      : [];

    const exists = sheetTitles.includes(SHEET_NAME);

    console.log({
      success: exists,
      message: exists
        ? "spreadsheet access ok"
        : `sheet "${SHEET_NAME}" was not found`,
      data: {
        spreadsheetId,
        spreadsheetTitle,
        sheetName: SHEET_NAME,
        sheetTitles,
      },
    });

    if (exists) {
      console.log("\n✅ Spreadsheet access OK");
    } else {
      console.log("\n❌ Spreadsheet access NG");
      process.exit(1);
    }
  } catch (error) {
    console.log({
      success: false,
      message: error.message,
      data: null,
    });
    console.log("\n❌ Spreadsheet access NG");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("unexpected error:", error);
  process.exit(1);
});