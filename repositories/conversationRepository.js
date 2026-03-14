// ファイル: voice-ai-dashboard/repositories/conversationRepository.js
"use strict";

const { appendRowToSheet } = require("../sheet/saver");
const { log, error: logError } = require("../utils/logger");
const { success, fail } = require("../utils/serviceResponse");

// ===== ENV 読み込み確認 =====
console.log("ENV CHECK (conversationRepository)", {
  SPREADSHEET_ID: process.env.SPREADSHEET_ID || "(undefined)",
  CONVERSATION_SHEET_NAME: process.env.CONVERSATION_SHEET_NAME || "(undefined)",
});

const SPREADSHEET_ID = String(process.env.SPREADSHEET_ID || "").trim();
const CONVERSATION_SHEET_NAME = String(
  process.env.CONVERSATION_SHEET_NAME || "conversation_history"
).trim();

// ===== ENV 確定値確認 =====
console.log("ENV NORMALIZED", {
  spreadsheetId: SPREADSHEET_ID || "(empty)",
  sheetName: CONVERSATION_SHEET_NAME,
});

// ===== 行データ作成 =====
function buildConversationRow(input = {}) {
  const row = [
    input.timestamp || Date.now(),                         // timestamp
    input.botId || "",                                     // bot_id
    input.userId || "",                                    // user_id
    input.userMessage || "",                               // user_message
    input.aiReply || "",                                   // ai_reply
    input.operatorMemo == null ? "" : input.operatorMemo,  // operator_memo
    typeof input.manualSend === "boolean" ? input.manualSend : false, // manual_send
    input.sourceType || "user_message",                    // source_type
    typeof input.unresolvedQ === "boolean" ? input.unresolvedQ : false, // unresolved_q
  ];

  console.log("DEBUG buildConversationRow", row);

  return row;
}

// ===== append 実行 =====
async function appendConversationRow(input = {}) {
  try {
    console.log("DEBUG appendConversationRow input", input);

    if (!SPREADSHEET_ID) {
      console.log("ERROR: SPREADSHEET_ID missing");
      return fail(
        "conversationRepository.appendConversationRow: SPREADSHEET_ID is required"
      );
    }

    if (!CONVERSATION_SHEET_NAME) {
      console.log("ERROR: CONVERSATION_SHEET_NAME missing");
      return fail(
        "conversationRepository.appendConversationRow: CONVERSATION_SHEET_NAME is required"
      );
    }

    const values = buildConversationRow(input);

    console.log("DEBUG appendRowToSheet call", {
      spreadsheetId: SPREADSHEET_ID,
      sheetName: CONVERSATION_SHEET_NAME,
      values,
    });

    await appendRowToSheet({
      spreadsheetId: SPREADSHEET_ID,
      sheetName: CONVERSATION_SHEET_NAME,
      values,
    });

    console.log("SUCCESS appendConversationRow");

    return success(
      "conversationRepository.appendConversationRow: appended",
      {
        sheetName: CONVERSATION_SHEET_NAME,
      }
    );
  } catch (error) {
    console.error("appendConversationRow failed", error);

    logError("conversationRepository.appendConversationRow failed", {
      message: error.message,
      stack: error.stack,
    });

    return fail(
      `conversationRepository.appendConversationRow failed: ${error.message}`
    );
  }
}

module.exports = {
  buildConversationRow,
  appendConversationRow,
};