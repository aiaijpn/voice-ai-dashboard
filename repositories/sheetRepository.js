"use strict";

const { appendRowToSheet } = require("../sheet/saver");
const { success, fail } = require("../utils/serviceResponse");

const SPREADSHEET_ID = String(process.env.SPREADSHEET_ID || "").trim();
const LOG_SHEET_NAME = "logs";

async function appendVoiceRow(rowData = {}) {
  try {
    console.log("DEBUG appendVoiceRow rowData =", rowData);

    if (!SPREADSHEET_ID) {
      return fail(
        "sheetRepository.appendVoiceRow: SPREADSHEET_ID is required"
      );
    }

    const values = [
      rowData.timestamp || Date.now(),
      rowData.botId || "",
      rowData.userId || "",
      rowData.userMessage || rowData.user_text || "",
      rowData.aiReply || rowData.reply_text || "",
      rowData.category || "",
      rowData.urgency || rowData.urgency_score || "",
      rowData.operatorMemo || rowData.summary || "",
    ];

    console.log("DEBUG appendVoiceRow values =", values);

    const result = await appendRowToSheet({
      spreadsheetId: SPREADSHEET_ID,
      sheetName: LOG_SHEET_NAME,
      values,
    });

    console.log("DEBUG appendVoiceRow result =", result);

    if (!result.success) {
      return fail(`sheetRepository.appendVoiceRow: ${result.message}`);
    }

    return success("Voice row appended", {
      sheetName: LOG_SHEET_NAME,
      userId: rowData.userId || "",
      botId: rowData.botId || "",
    });
  } catch (error) {
    console.error("DEBUG appendVoiceRow catch error =", error);

    return fail(`sheetRepository.appendVoiceRow: ${error.message}`);
  }
}

module.exports = {
  appendVoiceRow,
};