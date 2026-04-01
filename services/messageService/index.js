"use strict";

/**
 * services/messageService/index.js
 *
 * V3.5 接続版
 *
 * 役割:
 * - LINE handler から受けた userMessage を V3.5 へ渡す
 * - V3.5の返答を conversation_history に保存する
 * - handler が使う replyText を返す
 *
 * 方針:
 * - 会話ロジック本体は services/v35/ に集約
 * - messageService は入口と保存に絞る
 */

const { log, error: logError } = require("../../utils/logger");
const { success, fail } = require("../../utils/serviceResponse");

const { saveConversationHistory } = require("../historyService");
const { runV35 } = require("../v35");

const {
  buildProcessMessageSuccessData,
} = require("./buildReply");

log("📦 messageService/index.js loaded:", new Date().toISOString());

/**
 * V3.5 会話処理
 *
 * @param {Object} context
 * @param {string} context.rid
 * @param {string} context.bot_id
 * @param {string} context.userId
 * @param {string} context.text
 * @returns {Promise<{success:boolean,message:string,data:any}>}
 */
async function processMessage(context = {}) {
  const {
    rid = "no_rid",
    bot_id = "voice-ai-dashboard",
    userId = "",
    text = "",
  } = context;

  try {
    const userMessage = String(text || "").trim();

    if (!userId) {
      return fail("processMessage: userId is required", {
        replyText: "",
        userId,
        bot_id,
        rid,
      });
    }

    if (!userMessage) {
      return fail("processMessage: text is required", {
        replyText: "",
        userId,
        bot_id,
        rid,
      });
    }

    log(`🧠 [${rid}] V3.5 start`, {
      bot_id,
      userId,
      userMessage,
    });

    /**
     * 1. V3.5 実行
     */
    const v35Result = await runV35({
      rid,
      bot_id,
      userId,
      userMessage,
    });

    if (!v35Result?.success) {
      logError(`❌ [${rid}] runV35 failed:`, v35Result?.message || "unknown");

      return fail(v35Result?.message || "runV35 failed", {
        replyText: "",
        userId,
        bot_id,
        rid,
        v35Result: v35Result?.data || null,
      });
    }

    /**
     * 2. V3.5 結果取得
     */
    const replyText = String(v35Result.data?.replyText || "").trim() || "確認しました。";
    const matchedCompanyId = String(v35Result.data?.matchedCompanyId || "").trim();

    log(`🧩 [${rid}] V3.5 result`, {
      topicLabel: v35Result.data?.topicLabel || "",
      matchedCompanyId,
      judgement: v35Result.data?.judgement || "",
      stockAction: v35Result.data?.stockAction || "",
      wikiAction: v35Result.data?.wikiAction || "",
    });

    /**
     * 3. 履歴保存
     * - user_message
     * - ai_reply
     */
    await saveConversationHistory({
      botId: bot_id,
      userId,
      userMessage,
      sourceType: "user_message",
      companyId: matchedCompanyId,
    });

    await saveConversationHistory({
      botId: bot_id,
      userId,
      aiReply: replyText,
      sourceType: "ai_reply",
      companyId: matchedCompanyId,
    });

    /**
     * 4. handler 返却形式へ整形
     */
    return success(
      buildProcessMessageSuccessData({
        finalReply: replyText,
        parsed: v35Result.data || {},
        userId,
        bot_id,
        rid,
      }),
      "v35 reply"
    );
  } catch (error) {
    logError(`❌ [${rid}] processMessage failed:`, error?.message || error);

    return fail(error?.message || "processMessage failed", {
      replyText: "",
      userId,
      bot_id,
      rid,
    });
  }
}

module.exports = {
  processMessage,
};