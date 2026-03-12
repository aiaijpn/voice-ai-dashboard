"use strict";

const { appendRowToSheet } = require("../sheet/saver");
const { success, fail } = require("../utils/serviceResponse");




//const SHEET_ID = process.env.SHEET_ID || process.env.VOICE_AI_SHEET_ID;
const SHEET_ID = process.env.SHEET_ID;
const SHEET_NAME = "conversation_history";

async function appendConversationRow(rowData = {}) {
  try {

    console.log("DEBUG conversationRepository", {
        sheetId: SHEET_ID,
        sheetName: SHEET_NAME
    });


    if (!SHEET_ID) {
      return fail(
        "conversationRepository.appendConversationRow: SHEET_ID is required"
      );
    }

    const values = [
      rowData.timestamp || Date.now(),
      rowData.botId || "",
      rowData.userId || "",
      rowData.userMessage || "",
      rowData.aiReply || "",
      rowData.operatorMemo || "",
      typeof rowData.manualSend === "boolean" ? rowData.manualSend : false,
      rowData.sourceType || "user_message",
      typeof rowData.unresolvedQ === "boolean" ? rowData.unresolvedQ : false,
    ];

    const result = await appendRowToSheet({
      spreadsheetId: SHEET_ID,
      sheetName: SHEET_NAME,
      values,
    });

    if (!result.success) {
      return fail(
        `conversationRepository.appendConversationRow: ${result.message}`
      );
    }

    return success("Conversation row appended", {
      sheetName: SHEET_NAME,
      userId: rowData.userId || "",
      botId: rowData.botId || "",
    });
  } catch (error) {
    return fail(
      `conversationRepository.appendConversationRow: ${error.message}`
    );
  }
}

module.exports = {
  appendConversationRow,
};