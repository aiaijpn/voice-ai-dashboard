const { google } = require("googleapis");

async function appendRow(row) {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const credsRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!spreadsheetId) throw new Error("SPREADSHEET_ID is missing");
  if (!credsRaw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing");

  const credentials = JSON.parse(credsRaw);
  credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "logs!A:F",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        row.timestamp,
        row.user_text,
        row.summary,
        row.category,
        row.urgency_score,
        row.reply_text,
      ]],
    },
  });

  return true;
}

module.exports = { appendRow };

