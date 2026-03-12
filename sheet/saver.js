"use strict";

const { google } = require("googleapis");
const { log, error: logError } = require("../utils/logger");

function getServiceAccountJson() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    throw new Error(
      "sheet/saver.getServiceAccountJson: GOOGLE_SERVICE_ACCOUNT_JSON is required"
    );
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
    const safeSpreadsheetId = String(spreadsheetId || "").trim();
    const safeSheetName = String(sheetName || "").trim();

    if (!safeSpreadsheetId) {
      throw new Error("appendRowToSheet: spreadsheetId is required");
    }

    if (!safeSheetName) {
      throw new Error("appendRowToSheet: sheetName is required");
    }

    if (!Array.isArray(values)) {
      throw new Error("appendRowToSheet: values must be an array");
    }

    log("DEBUG appendRowToSheet args:", {
      spreadsheetId: safeSpreadsheetId,
      sheetName: safeSheetName,
      valueCount: values.length,
    });

    const sheets = createSheetsClient();

    await sheets.spreadsheets.values.append({
      spreadsheetId: safeSpreadsheetId,
      range: `${sheetName}!A1:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [values],
      },
    });

    log("Sheet append success:", {
      spreadsheetId: safeSpreadsheetId,
      sheetName: safeSheetName,
      valueCount: values.length,
    });

    return {
      success: true,
      message: "Sheet append success",
      data: {
        spreadsheetId: safeSpreadsheetId,
        sheetName: safeSheetName,
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