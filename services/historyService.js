"use strict";

"use strict";

/**
 * Conversation History 保存用 Service
 *
 * 役割:
 * - 入力データの正規化
 * - 必須項目の検証
 * - repository 呼び出し
 * - 上位層（messageService など）が使いやすい返り値に統一する
 */

const conversationRepository = require("../repositories/conversationRepository");
const { success, fail } = require("../utils/serviceResponse");

/**
 * 保存入力を正規化する
 */
function normalizeSaveInput(input = {}) {
  return {
    botId: String(input.botId || "").trim(),
    userId: String(input.userId || "").trim(),
    timestamp: input.timestamp || Date.now(),
    userMessage: String(input.userMessage || ""),
    aiReply: String(input.aiReply || ""),
    operatorMemo:
      input.operatorMemo === null || input.operatorMemo === undefined
        ? ""
        : String(input.operatorMemo),
    manualSend:
      typeof input.manualSend === "boolean" ? input.manualSend : false,
    sourceType: String(input.sourceType || "message"),
    unresolvedQ:
      typeof input.unresolvedQ === "boolean" ? input.unresolvedQ : false,
  };
}

/**
 * 保存入力の必須項目を検証する
 */
function validateSaveInput(input = {}) {
  if (!input.botId) {
    return fail("historyService.validateSaveInput: botId is required");
  }

  if (!input.userId) {
    return fail("historyService.validateSaveInput: userId is required");
  }

  return success(
    {
      validated: true,
    },
    "historyService.validateSaveInput: ok"
  );
}

/**
 * repository 呼び出し関数を取得する
 *
 * 目的:
 * - 単体テスト時にモック差し替えしやすくする
 */
function getAppendConversationRow() {
  return conversationRepository.appendConversationRow;
}

/**
 * 会話履歴を保存する service 本体
 */
async function saveConversationHistory(input = {}) {
  try {
    const normalized = normalizeSaveInput(input);

    const validation = validateSaveInput(normalized);
    if (!validation.success) {
      return validation;
    }

    const appendConversationRow = getAppendConversationRow();
    const result = await appendConversationRow(normalized);

    if (!result.success) {
      return fail(
        result.message ||
          "historyService.saveConversationHistory: repository failed",
        result.data || null
      );
    }

    return success(
      {
        saved: true,
        normalized,
        repositoryResult: result.data || null,
      },
      "historyService.saveConversationHistory: saved"
    );
  } catch (error) {
    return fail(`historyService.saveConversationHistory: ${error.message}`);
  }
}

module.exports = {
  normalizeSaveInput,
  validateSaveInput,
  getAppendConversationRow,
  saveConversationHistory,
};