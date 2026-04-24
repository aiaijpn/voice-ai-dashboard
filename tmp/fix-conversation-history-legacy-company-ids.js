"use strict";

require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const LEGACY_ID_MAP = Object.freeze({
  kanai_suits: "kanai_suit",
  ikeda_legal: "ikeda_law",
});

function toSafeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function createSheetsClient() {
  const filePath = String(process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "").trim();
  const rawJson = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();

  let credentials = null;

  if (filePath) {
    const resolvedPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Service account file not found: ${resolvedPath}`);
    }

    credentials = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  } else if (rawJson) {
    credentials = JSON.parse(rawJson);
  } else {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_FILE or GOOGLE_SERVICE_ACCOUNT_JSON is required"
    );
  }

  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }

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
  const spreadsheetId = String(process.env.SPREADSHEET_ID || "").trim();

  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID is not set");
  }

  const sheets = createSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "conversation_history!A:J",
  });

  const rows = Array.isArray(response?.data?.values) ? response.data.values : [];
  const dataRows = rows.slice(1);

  const targets = dataRows
    .map((row, index) => {
      const rowNumber = index + 2;
      const oldId = toSafeString(row[9]);
      const newId = LEGACY_ID_MAP[oldId] || "";

      if (!newId) {
        return null;
      }

      return {
        rowNumber,
        oldId,
        newId,
      };
    })
    .filter(Boolean);

  if (targets.length === 0) {
    console.log(
      JSON.stringify(
        {
          updatedCount: 0,
          updatedRows: [],
        },
        null,
        2
      )
    );
    return;
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: targets.map((item) => ({
        range: `conversation_history!J${item.rowNumber}`,
        values: [[item.newId]],
      })),
    },
  });

  const verifyResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "conversation_history!A:J",
  });
  const verifyRows = Array.isArray(verifyResponse?.data?.values)
    ? verifyResponse.data.values
    : [];

  const remainingLegacy = verifyRows
    .slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      companyId: toSafeString(row[9]),
    }))
    .filter((item) => LEGACY_ID_MAP[item.companyId]);

  console.log(
    JSON.stringify(
      {
        updatedCount: targets.length,
        updatedRows: targets,
        remainingLegacyCount: remainingLegacy.length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exit(1);
});
