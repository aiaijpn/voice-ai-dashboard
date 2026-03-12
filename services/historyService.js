"use strict";

const { log, error: logError } = require("../utils/logger");
const { success, fail } = require("../utils/serviceResponse");
const {
  appendConversationRow,
} = require("../repositories/conversationRepository");

function normalizeSaveInput(input = {}) {
  return {
    botId: input.botId || "",
    userId: input.userId || "",
    timestamp: input.timestamp || Date.now(),

    userMessage: input.userMessage || "",
    aiReply: input.aiReply || "",

    operatorMemo:
      input.operatorMemo === null || input.operatorMemo === undefined
        ? ""
        : input.operatorMemo,

    manualSend:
      typeof input.manualSend === "boolean" ? input.manualSend : false,

    sourceType: input.sourceType || "user_message",

    unresolvedQ:
      typeof input.unresolvedQ === "boolean" ? input.unresolvedQ : false,
  };
}

function validateSaveInput(input) {
  if (!input.botId) {
    return fail("historyService.validateSaveInput: botId is required");
  }

  if (!input.userId) {
    return fail("historyService.validateSaveInput: userId is required");
  }

  if (!input.userMessage) {
    return fail("historyService.validateSaveInput: userMessage is required");
  }

  return success("validation ok", null);
}

async function saveConversation(input = {}) {
  try {
    const normalized = normalizeSaveInput(input);
    const validation = validateSaveInput(normalized);

    if (!validation.success) {
      logError(
        "historyService.saveConversation validation failed:",
        validation.message,
        {
          botId: normalized.botId,
          userId: normalized.userId,
          sourceType: normalized.sourceType,
        }
      );
      return validation;
    }
    
    // ↓ ここを一旦停止
    //const result = await appendConversationRow(normalized);

    if (!result.success) {
      logError("historyService.saveConversation append failed:", result.message, {
        botId: normalized.botId,
        userId: normalized.userId,
        sourceType: normalized.sourceType,
      });
      return result;
    }

    log("historyService.saveConversation success", {
      botId: normalized.botId,
      userId: normalized.userId,
      sourceType: normalized.sourceType,
      timestamp: normalized.timestamp,
    });

    return success("conversation saved", {
      timestamp: normalized.timestamp,
      botId: normalized.botId,
      userId: normalized.userId,
      sourceType: normalized.sourceType,
    });
  } catch (error) {
    logError(
      "historyService.saveConversation error:",
      error.message || error
    );
    return fail("failed to save conversation", error.message || error);
  }
}

module.exports = {
  saveConversation,
};