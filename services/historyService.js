"use strict";

const { success } = require("../utils/serviceResponse");

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
  return success("history input skipped", input);
}

async function saveConversation(input = {}) {
  const normalized = normalizeSaveInput(input);

  return success("conversation history disabled", {
    botId: normalized.botId,
    userId: normalized.userId,
    sourceType: normalized.sourceType,
  });
}

module.exports = {
  saveConversation,
  normalizeSaveInput,
  validateSaveInput,
};