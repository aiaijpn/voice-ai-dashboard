"use strict";

const { appendRowToSheet } = require("../sheet/saver");
const { success, fail } = require("../utils/serviceResponse");

const SPREADSHEET_ID = String(process.env.SPREADSHEET_ID || "").trim();
const LOG_SHEET_NAME = "logs";

async function appendVoiceRow(rowData = {}) {
  try {
    if (!SPREADSHEET_ID) {
      return fail(
        "sheetRepository.appendVoiceRow: SPREADSHEET_ID is required"
      );
    }

    const values = [
      rowData.timestamp || Date.now(),
      rowData.botId || "",
      rowData.userId || "",
      rowData.userMessage || "",
      rowData.aiReply || "",
      rowData.category || "",
      rowData.urgency || "",
      rowData.operatorMemo || "",
    ];

    const result = await appendRowToSheet({
      spreadsheetId: SPREADSHEET_ID,
      sheetName: LOG_SHEET_NAME,
      values,
    });

    if (!result.success) {
      return fail(`sheetRepository.appendVoiceRow: ${result.message}`);
    }

    return success("Voice row appended", {
      sheetName: LOG_SHEET_NAME,
      userId: rowData.userId || "",
      botId: rowData.botId || "",
    });
  } catch (error) {
    return fail(`sheetRepository.appendVoiceRow: ${error.message}`);
  }
}

module.exports = {
  appendVoiceRow,
};