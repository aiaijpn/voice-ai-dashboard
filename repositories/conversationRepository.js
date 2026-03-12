"use strict";

const { google } = require("googleapis");
const { log, error: logError } = require("../utils/logger");
const { success, fail } = require("../utils/serviceResponse");

const GOOGLE_SERVICE_ACCOUNT_JSON =
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "";
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "";
const CONVERSATION_SHEET_NAME =
  process.env.CONVERSATION_SHEET_NAME || "conversation_history";

function buildAuth() {
  if (!GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing");
  }

  let credentials;
  try {
    credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch (e) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON parse failed");
  }

  if (!credentials.client_email) {
    throw new Error("client_email is missing in GOOGLE_SERVICE_ACCOUNT_JSON");
  }

  if (!credentials.private_key) {
    throw new Error("private_key is missing in GOOGLE_SERVICE_ACCOUNT_JSON");
  }

  return new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
}

function normalizeRecord(record = {}) {
  return {
    timestamp: record.timestamp || Date.now(),
    botId: record.botId || "",
    userId: record.userId || "",
    userMessage: record.userMessage || "",
    aiReply: record.aiReply || "",
    sourceType: record.sourceType || "user_message",
    operatorMemo: record.operatorMemo || "",
    manualSend:
      typeof record.manualSend === "boolean" ? record.manualSend : false,
    unresolvedQ:
      typeof record.unresolvedQ === "boolean" ? record.unresolvedQ : false,
  };
}

function validateRecord(record) {
  if (!record.botId) {
    return fail("conversationRepository.validateRecord: botId is required");
  }

  if (!record.userId) {
    return fail("conversationRepository.validateRecord: userId is required");
  }

  if (!record.userMessage) {
    return fail(
      "conversationRepository.validateRecord: userMessage is required"
    );
  }

  return success("validation ok", null);
}

function buildRow(record) {
  return [
    record.timestamp,
    record.botId,
    record.userId,
    record.userMessage,
    record.aiReply,
    record.sourceType,
    record.operatorMemo,
    record.manualSend,
    record.unresolvedQ,
  ];
}

async function appendConversationRow(record) {
  try {
    if (!SPREADSHEET_ID) {
      return fail("SPREADSHEET_ID is missing");
    }

    const normalized = normalizeRecord(record);
    const validation = validateRecord(normalized);

    if (!validation.success) {
      return validation;
    }

    const auth = buildAuth();
    const sheets = google.sheets({ version: "v4", auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CONVERSATION_SHEET_NAME}!A:I`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [buildRow(normalized)],
      },
    });

    log("conversationRepository.appendConversationRow success", {
      sheetName: CONVERSATION_SHEET_NAME,
      botId: normalized.botId,
      userId: normalized.userId,
      timestamp: normalized.timestamp,
    });

    return success("conversation row appended", {
      timestamp: normalized.timestamp,
    });
  } catch (error) {
    logError(
      "conversationRepository.appendConversationRow error:",
      error.response?.data || error.message || error
    );
    return fail("failed to append conversation row", error.message || error);
  }
}

module.exports = {
  appendConversationRow,
};