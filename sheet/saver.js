const { google } = require("googleapis");

async function appendRow(row) {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const credsRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  console.log("📗 saver.js appendRow called");

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
          row.timestamp,
          row.user_text,
          row.summary,
          row.category,
          row.urgency_score,
          row.reply_text,
        ],
      ],
    },
  });

  return true;
}

module.exports = { appendRow };
