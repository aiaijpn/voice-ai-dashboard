"use strict";

const { google } = require("googleapis");
const { log, error: logError } = require("../utils/logger");
const { success, fail } = require("../utils/serviceResponse");

const GOOGLE_SERVICE_ACCOUNT_JSON =
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "";
const GOOGLE_SERVICE_ACCOUNT_EMAIL =
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY || "";
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const CONVERSATION_SHEET_NAME =
  process.env.CONVERSATION_SHEET_NAME || "conversation_history";

function buildAuth() {
  try {
    if (GOOGLE_SERVICE_ACCOUNT_JSON) {
      const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);

      return new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        ["https://www.googleapis.com/auth/spreadsheets"]
      );
    }

    if (GOOGLE_SERVICE_ACCOUNT_EMAIL && GOOGLE_PRIVATE_KEY) {
      return new google.auth.JWT(
        GOOGLE_SERVICE_ACCOUNT_EMAIL,
        null,
        GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        ["https://www.googleapis.com/auth/spreadsheets"]
      );
    }

    throw new Error(
      "conversationRepository.buildAuth: Google service account env is missing"
    );
  } catch (error) {
    throw new Error(
      `conversationRepository.buildAuth failed: ${error.message || error}`
    );
  }
}

function buildSheetsClient(auth) {
  return google.sheets({ version: "v4", auth });
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
      logError(
        "conversationRepository.appendConversationRow: SPREADSHEET_ID is missing"
      );
      return fail("SPREADSHEET_ID is missing");
    }

    const normalized = normalizeRecord(record);
    const validation = validateRecord(normalized);

    if (!validation.success) {
      logError(
        "conversationRepository.appendConversationRow validation failed:",
        validation.message
      );
      return validation;
    }

    const auth = buildAuth();
    const sheets = buildSheetsClient(auth);
    const row = buildRow(normalized);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CONVERSATION_SHEET_NAME}!A:I`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [row],
      },
    });

    log("conversationRepository.appendConversationRow success", {
      sheetName: CONVERSATION_SHEET_NAME,
      botId: normalized.botId,
      userId: normalized.userId,
      sourceType: normalized.sourceType,
      timestamp: normalized.timestamp,
    });

    return success("conversation row appended", {
      sheetName: CONVERSATION_SHEET_NAME,
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