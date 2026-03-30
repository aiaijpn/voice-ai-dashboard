"use strict";

/**
 * Conversation History Service
 *
 * 役割:
 * - 保存入力データの正規化
 * - 保存必須項目の検証
 * - 取得入力データの正規化
 * - 取得必須項目の検証
 * - repository 呼び出し
 * - 上位層（messageService / adminMessageService など）が使いやすい返り値に統一する
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

    sourceType: String(input.sourceType || "user_message").trim(),

    unresolvedQ:
      typeof input.unresolvedQ === "boolean" ? input.unresolvedQ : false,

    companyId: String(input.companyId || "").trim(),
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

  const allowedSourceTypes = [
    "user_message",
    "ai_reply",
    "admin_message",
    "system_event",
  ];

  if (!allowedSourceTypes.includes(input.sourceType)) {
    return fail(
      `historyService.validateSaveInput: invalid sourceType: ${input.sourceType}`
    );
  }

  if (input.sourceType === "user_message" && !input.userMessage) {
    return fail(
      "historyService.validateSaveInput: userMessage is required for user_message"
    );
  }

  if (input.sourceType === "ai_reply" && !input.aiReply) {
    return fail(
      "historyService.validateSaveInput: aiReply is required for ai_reply"
    );
  }

  if (input.sourceType === "admin_message") {
    if (!input.aiReply) {
      return fail(
        "historyService.validateSaveInput: aiReply is required for admin_message"
      );
    }

    if (input.manualSend !== true) {
      return fail(
        "historyService.validateSaveInput: manualSend must be true for admin_message"
      );
    }
  }

  return success(
    {
      validated: true,
    },
    "historyService.validateSaveInput: ok"
  );
}

/**
 * 取得入力を正規化する
 */
function normalizeGetInput(input = {}) {
  const rawLimit = Number(input.limit);

  return {
    botId: String(input.botId || "").trim(),
    userId: String(input.userId || "").trim(),
    limit: Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 6,
  };
}

/**
 * 取得入力の必須項目を検証する
 */
function validateGetInput(input = {}) {
  if (!input.botId) {
    return fail("historyService.validateGetInput: botId is required");
  }

  if (!input.userId) {
    return fail("historyService.validateGetInput: userId is required");
  }

  if (!Number.isInteger(input.limit) || input.limit <= 0) {
    return fail("historyService.validateGetInput: limit must be positive integer");
  }

  return success(
    {
      validated: true,
    },
    "historyService.validateGetInput: ok"
  );
}

/**
 * repository の保存関数を取得する
 *
 * 目的:
 * - 単体テスト時にモック差し替えしやすくする
 */
function getAppendConversationRow() {
  return conversationRepository.appendConversationRow;
}

/**
 * repository の取得関数を取得する
 *
 * 目的:
 * - 単体テスト時にモック差し替えしやすくする
 */
function getGetConversationHistory() {
  return conversationRepository.getConversationHistory;
}

/**
 * 履歴配列から最新の companyId を返す
 *
 * 方針:
 * - 新しい順に見つけたいので後ろから走査する
 * - 空文字は無視する
 * - 見つからなければ null
 *
 * @param {Array} items
 * @returns {string|null}
 */
function findLatestCompanyId(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  for (let i = items.length - 1; i >= 0; i -= 1) {
    const companyId = String(items[i]?.companyId || "").trim();
    if (companyId) {
      return companyId;
    }
  }

  return null;
}

/**
 * botId + userId の履歴から
 * 最新の companyId を取得する
 *
 * @param {Object} input
 * @param {string} input.botId
 * @param {string} input.userId
 * @param {number} [input.limit=10]
 * @returns {Promise<{success:boolean,message:string,data:any}>}
 */
async function getLatestCompanyIdFromHistory(input = {}) {
  try {
    const historyResult = await getConversationHistory({
      botId: input.botId,
      userId: input.userId,
      limit: input.limit || 10,
    });

    if (!historyResult.success) {
      return fail(
        historyResult.message ||
          "historyService.getLatestCompanyIdFromHistory: history fetch failed",
        historyResult.data || null
      );
    }

    const items = Array.isArray(historyResult.data?.items)
      ? historyResult.data.items
      : [];

    const companyId = findLatestCompanyId(items);

    return success(
      {
        companyId,
        itemsCount: items.length,
      },
      "historyService.getLatestCompanyIdFromHistory: fetched"
    );
  } catch (error) {
    return fail(
      `historyService.getLatestCompanyIdFromHistory: ${error.message}`
    );
  }
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

/**
 * 会話履歴を取得する service 本体
 */
async function getConversationHistory(input = {}) {
  try {
    const normalized = normalizeGetInput(input);

    const validation = validateGetInput(normalized);
    if (!validation.success) {
      return validation;
    }

    const getConversationHistoryRepository = getGetConversationHistory();
    const result = await getConversationHistoryRepository(normalized);

    if (!result.success) {
      return fail(
        result.message ||
          "historyService.getConversationHistory: repository failed",
        result.data || null
      );
    }

    return success(
      {
        fetched: true,
        normalized,
        items:
          result.data && Array.isArray(result.data.items) ? result.data.items : [],
        repositoryResult: result.data || null,
      },
      "historyService.getConversationHistory: fetched"
    );
  } catch (error) {
    return fail(`historyService.getConversationHistory: ${error.message}`);
  }
}

module.exports = {
  normalizeSaveInput,
  validateSaveInput,
  normalizeGetInput,
  validateGetInput,
  getAppendConversationRow,
  getGetConversationHistory,
  findLatestCompanyId,
  getLatestCompanyIdFromHistory,
  saveConversationHistory,
  getConversationHistory,
};