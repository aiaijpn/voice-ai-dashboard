"use strict";

const { google } = require("googleapis");
const { log, error: logError } = require("../utils/logger");

function getServiceAccountJson() {
  const raw = process.env.SA_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    throw new Error("sheet/saver.getServiceAccountJson: SA_JSON is required");
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `sheet/saver.getServiceAccountJson: invalid JSON: ${error.message}`
    );
  }
}

function createSheetsClient() {
  const serviceAccount = getServiceAccountJson();

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({
    version: "v4",
    auth,
  });
}

async function appendRowToSheet({ spreadsheetId, sheetName, values }) {
  try {
    if (!spreadsheetId) {
      throw new Error("appendRowToSheet: spreadsheetId is required");
    }

    if (!sheetName) {
      throw new Error("appendRowToSheet: sheetName is required");
    }

    if (!Array.isArray(values)) {
      throw new Error("appendRowToSheet: values must be an array");
    }

    const sheets = createSheetsClient();

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [values],
      },
    });

    log("Sheet append success:", {
      spreadsheetId,
      sheetName,
      valueCount: values.length,
    });

    return {
      success: true,
      message: "Sheet append success",
      data: {
        spreadsheetId,
        sheetName,
      },
    };
  } catch (error) {
    logError("appendRowToSheet error:", error.message);

    return {
      success: false,
      message: `appendRowToSheet: ${error.message}`,
      data: null,
    };
  }
}

module.exports = {
  appendRowToSheet,
};