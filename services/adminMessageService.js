"use strict";

/**
 * ADR-009
 * 管理者送信メッセージ履歴保存用 Service
 *
 * 役割:
 * - Operator Panel 送信メッセージを
 *   conversation_history に admin_message として保存する
 *
 * 重要:
 * - sheet/saver を直接呼ばない
 * - 必ず historyService を通す
 */

const { success, fail } = require("../utils/serviceResponse");
const { saveConversationHistory } = require("./historyService");

async function saveAdminMessageHistory(input = {}) {
  try {
    const botId = String(input.botId || "").trim();
    const userId = String(input.userId || "").trim();
    const messageText = String(input.messageText || "");
    const operatorMemo =
      input.operatorMemo === null || input.operatorMemo === undefined
        ? "operator panel send"
        : String(input.operatorMemo);
    const timestamp = input.timestamp || Date.now();

    if (!botId) {
      return fail("adminMessageService.saveAdminMessageHistory: botId is required");
    }

    if (!userId) {
      return fail("adminMessageService.saveAdminMessageHistory: userId is required");
    }

    if (!messageText) {
      return fail(
        "adminMessageService.saveAdminMessageHistory: messageText is required"
      );
    }

    return await saveConversationHistory({
      botId,
      userId,
      timestamp,
      sourceType: "admin_message",
      userMessage: "",
      aiReply: messageText,
      operatorMemo,
      manualSend: true,
      unresolvedQ: false,
    });
  } catch (error) {
    return fail(`adminMessageService.saveAdminMessageHistory: ${error.message}`);
  }
}

module.exports = {
  saveAdminMessageHistory,
};