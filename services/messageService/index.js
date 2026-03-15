"use strict";

/**
 * messageService / index
 *
 * このファイルは messageService の「司令塔」です。
 *
 * 役割:
 * - ユーザメッセージを受け取り
 * - 会話履歴を取得する
 * - AIへ問い合わせ
 * - 応答を生成
 * - 各ログ保存
 * - 会話履歴保存
 * - 最終返信を返す
 *
 * ADR構造的には
 *
 * handler
 *   ↓
 * messageService/index.js   ← このファイル
 *   ↓
 * historyService
 *   ↓
 * conversationRepository
 *   ↓
 * sheet/saver
 *
 * という流れになります。
 *
 * このファイルの責務:
 * - 処理フローのオーケストレーション
 * - 各モジュール呼び出し
 * - OpenAI messages 配列の組み立て
 *
 * このファイルでやらないこと:
 * - OpenAI API の直接実装
 * - Google Sheets API 呼び出し
 * - 会話履歴保存の内部処理
 * - 会話履歴取得の内部処理
 *
 * それらはそれぞれ別モジュールへ委譲します。
 */

const { log, error: logError } = require("../../utils/logger");
const { insertAd } = require("../../ads/adService");
const { success, fail } = require("../../utils/serviceResponse");

/**
 * ADR-008 / ADR-010 / ADR-011
 * 会話履歴保存 / 取得 service
 */
const {
  saveConversationHistory,
  getConversationHistory,
} = require("../historyService");

/**
 * messageService 内部分割モジュール
 */
const { buildSystemPrompt } = require("./promptBuilder");
const { callOpenAI, OPENAI_MODEL } = require("./openaiClient");
const { parseOpenAIResponse } = require("./responseParser");
const { saveUsage, saveVoiceLog } = require("./logSavers");
const {
  buildReplyText,
  buildProcessMessageSuccessData,
} = require("./buildReply");

/**
 * 起動ログ
 */
log("📦 messageService/index.js loaded:", new Date().toISOString());
log("🔧 ENV CHECK (service/index)");
log(" - OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "OK" : "MISSING");
log(" - OPENAI_MODEL:", process.env.OPENAI_MODEL || "gpt-4o-mini");

/**
 * repository/service から返ってきた履歴1件を
 * OpenAI messages 形式へ変換する
 *
 * ルール:
 * - user_message → user
 * - ai_reply → assistant
 * - admin_message → 除外
 * - 空文字は除外
 *
 * @param {Object} item
 * @returns {Object|null}
 */
function mapHistoryItemToOpenAIMessages(item = {}) {
  const sourceType = String(item.sourceType || "").trim();

  if (sourceType === "user_message") {
    const content = String(item.userMessage || "").trim();
    if (!content) {
      return null;
    }

    return {
      role: "user",
      content,
    };
  }

  if (sourceType === "ai_reply") {
    const content = String(item.aiReply || "").trim();
    if (!content) {
      return null;
    }

    return {
      role: "assistant",
      content,
    };
  }

  /**
   * ADR-011 方針:
   * admin_message は今回は OpenAI messages に入れない
   */
  return null;
}

/**
 * 会話履歴配列を OpenAI messages 配列へ変換する
 *
 * @param {Array} items
 * @returns {Array}
 */
function buildHistoryMessages(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map(mapHistoryItemToOpenAIMessages).filter(Boolean);
}

/**
 * OpenAI へ渡す messages を構築する
 *
 * 順番:
 * 1. system
 * 2. history (古い→新しい)
 * 3. current user
 *
 * @param {Object} input
 * @param {string} input.systemPrompt
 * @param {Array} input.historyItems
 * @param {string} input.text
 * @returns {Array}
 */
function buildOpenAIMessages(input = {}) {
  const systemPrompt = String(input.systemPrompt || "");
  const text = String(input.text || "");
  const historyItems = Array.isArray(input.historyItems)
    ? input.historyItems
    : [];

  const messages = [];

  messages.push({
    role: "system",
    content: systemPrompt,
  });

  const historyMessages = buildHistoryMessages(historyItems);
  messages.push(...historyMessages);

  messages.push({
    role: "user",
    content: text,
  });

  return messages;
}

/**
 * messageService のメイン処理
 *
 * @param {Object} context
 *
 * context 例
 * {
 *   rid: request id
 *   bot_id: bot識別
 *   userId: LINE user id
 *   text: ユーザ入力
 *   tone: AIトーン
 * }
 */
async function processMessage(context) {
  /**
   * context を安全に展開
   *
   * undefined が来ても壊れないように
   * デフォルト値を与える
   */
  const {
    rid = "no_rid",
    bot_id = "voice-ai-dashboard",
    userId = "",
    text = "",
    tone = "polite",
  } = context || {};

  try {
    /**
     * 1
     * System Prompt 構築
     *
     * tone
     * request id
     * log
     * を元にAIの基本プロンプトを生成
     */
    const systemPrompt = await buildSystemPrompt({
      tone,
      rid,
      log,
    });

    /**
     * 2
     * 会話履歴取得
     *
     * - botId + userId で取得
     * - 取得件数は 10
     * - admin_message は後段で除外
     * - 空履歴でも続行
     */
    let historyItems = [];

    log(`📚 [${rid}] conversation history fetch requested`, {
      botId: bot_id,
      userId,
      limit: 10,
    });

    const historyResult = await getConversationHistory({
      botId: bot_id,
      userId,
      limit: 10,
    });

    if (!historyResult.success) {
      logError(
        `❌ [${rid}] conversation history fetch failed:`,
        historyResult.message
      );
    } else {
      historyItems = Array.isArray(historyResult.data?.items)
        ? historyResult.data.items
        : [];

      log(`✅ [${rid}] conversation history fetched`, {
        botId: bot_id,
        userId,
        historyCount: historyItems.length,
      });
    }

    /**
     * 3
     * OpenAI messages 構築
     *
     * 順番:
     * system
     * history
     * current user
     */
    const messages = buildOpenAIMessages({
      systemPrompt,
      historyItems,
      text,
    });

    log(`🧠 [${rid}] OpenAI messages built`, {
      botId: bot_id,
      userId,
      messageCount: messages.length,
      historyCount: historyItems.length,
    });

    /**
     * 4
     * OpenAI 呼び出し
     */
    const response = await callOpenAI({
      systemPrompt,
      text,
      messages,
      rid,
      log,
    });

    /**
     * 5
     * usageログ保存
     *
     * OpenAI token 使用量など
     */
    await saveUsage({
      response,
      bot_id,
      rid,
      openaiModel: OPENAI_MODEL,
      log,
      logError,
    });

    /**
     * 6
     * AI応答パース
     *
     * OpenAIの raw response を
     * replyText
     * parsed
     * に分解
     */
    const { parsed, replyText } = parseOpenAIResponse(
      response,
      text,
      rid,
      log
    );

    log(`✅ [${rid}] AI reply generated`, {
      botId: bot_id,
      userId,
    });

    /**
     * 7
     * voiceログ保存
     *
     * お客様の声ログ
     */
    await saveVoiceLog({
      parsed,
      text,
      rid,
      log,
      logError,
    });

    /**
     * 8
     * 広告挿入
     */
    let finalReply = buildReplyText(replyText);
    finalReply = await insertAd(finalReply);
    finalReply = buildReplyText(finalReply);

    /**
     * 9
     * 会話履歴保存
     *
     * user_message
     * ai_reply
     * を別イベントで保存する
     */

    log(`📝 [${rid}] user_message history save requested`, {
      botId: bot_id,
      userId,
      sourceType: "user_message",
    });

    const userHistoryResult = await saveConversationHistory({
      botId: bot_id,
      userId,
      userMessage: text,
      sourceType: "user_message",
    });

    if (!userHistoryResult.success) {
      logError(
        `❌ [${rid}] user_message history save failed:`,
        userHistoryResult.message
      );
    } else {
      log(`✅ [${rid}] user_message history saved`, {
        botId: bot_id,
        userId,
        sourceType: "user_message",
      });
    }

    log(`📝 [${rid}] ai_reply history save requested`, {
      botId: bot_id,
      userId,
      sourceType: "ai_reply",
    });

    const aiHistoryResult = await saveConversationHistory({
      botId: bot_id,
      userId,
      aiReply: finalReply,
      sourceType: "ai_reply",
    });

    if (!aiHistoryResult.success) {
      logError(
        `❌ [${rid}] ai_reply history save failed:`,
        aiHistoryResult.message
      );
    } else {
      log(`✅ [${rid}] ai_reply history saved`, {
        botId: bot_id,
        userId,
        sourceType: "ai_reply",
      });
    }

    /**
     * 10
     * 最終レスポンス
     */
    return success(
      buildProcessMessageSuccessData({
        finalReply,
        parsed,
        userId,
        bot_id,
        rid,
      }),
      "processMessage ok"
    );
  } catch (e) {
    /**
     * 想定外エラー
     */
    logError(`❌ [${rid}] processMessage failed:`, e?.message || e);

    return fail(e?.message || "processMessage failed", {
      replyText: "",
      userId,
      bot_id,
      rid,
    });
  }
}

/**
 * export
 */
module.exports = {
  processMessage,
  mapHistoryItemToOpenAIMessages,
  buildHistoryMessages,
  buildOpenAIMessages,
};