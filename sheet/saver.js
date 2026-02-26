"use strict";

const { google } = require("googleapis");

// 共通：Sheets クライアント生成（毎回同じ）
function getSheetsClient() {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const credsRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!spreadsheetId) throw new Error("SPREADSHEET_ID is missing");
  if (!credsRaw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing");

  let credentials;
  try {
    credentials = JSON.parse(credsRaw);
  } catch (e) {
    console.error("❌ GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
    throw e;
  }

  // Render の env に貼ると private_key の改行が \\n になることがあるので補正
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  return { sheets, spreadsheetId };
}

// 既存：logs シートへ保存（A:F）
async function appendRow(row) {
  console.log("📗 saver.js appendRow called");

  const { sheets, spreadsheetId } = getSheetsClient();

  console.log("📗 appending row to logs!A:F", {
    timestamp: row.timestamp,
    user_text: row.user_text,
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "logs!A:F",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          row.timestamp || "",
          row.user_text || "",
          row.summary || "",
          row.category ?? "",
          row.urgency_score ?? "",
          row.reply_text || "",
        ],
      ],
    },
  });

  return true;
}

// 追加：UsageLog シートへ保存（A:J）
async function appendUsageRow(u) {
  console.log("📊 saver.js appendUsageRow called");

  const { sheets, spreadsheetId } = getSheetsClient();

  const values = [
    [
      u.ts || "",
      u.bot_id || "",
      u.model || "",
      u.input_tokens ?? "",
      u.output_tokens ?? "",
      u.total_tokens ?? "",
      u.cost_usd ?? "",
      u.cost_jpy ?? "",
      u.rid || "",
      u.resp_id || "",
    ],
  ];

  console.log("📊 appending row to UsageLog!A:J", values[0]);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "UsageLog!A:J",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });

  console.log("✅ UsageLog append success");
  return true;
}

module.exports = {
  appendRow,
  appendUsageRow,
};
