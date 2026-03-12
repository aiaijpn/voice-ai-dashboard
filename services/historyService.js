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

  return success("history input valid", null);
}

async function saveConversation(input = {}) {
  try {
    const normalized = normalizeSaveInput(input);

    const valid = validateSaveInput(normalized);
    if (!valid.success) {
      return valid;
    }

    const result = await appendConversationRow(normalized);

    if (!result.success) {
      logError("historyService.saveConversation failed:", result.message);
      return result;
    }

    log("Conversation history saved:", {
      botId: normalized.botId,
      userId: normalized.userId,
      sourceType: normalized.sourceType,
    });

    return success("conversation history saved", {
      botId: normalized.botId,
      userId: normalized.userId,
      sourceType: normalized.sourceType,
    });
  } catch (error) {
    logError("historyService.saveConversation error:", error.message);
    return fail(`historyService.saveConversation: ${error.message}`);
  }
}

module.exports = {
  saveConversation,
  normalizeSaveInput,
  validateSaveInput,
};