"use strict";

/**
 * messageService / index
 *
 * このファイルは messageService の「司令塔」です。
 *
 * ADR014 対応版
 * 2026-03-15
 *
 * 目的
 * - 処理フローのオーケストレーション
 * - 各モジュールの呼び出し
 * - 保存データとAI入力コンテキストの責務分離
 *
 * このファイルでやらないこと
 * - OpenAI API 呼び出し実装
 * - JSON解析
 * - AI分類処理
 * - Google Sheets API 呼び出し
 * - 会話履歴保存の内部処理
 *
 * それらはすべて専用モジュールへ委譲する
 *
 * 処理フロー
 *
 * 1 systemPrompt 構築
 * 2 会話履歴取得
 * 3 OpenAI messages 構築
 * 4 OpenAI 呼び出し
 * 5 AIレスポンス解析
 * 6 AI分類
 * 7 voiceログ保存
 * 8 広告挿入
 * 9 会話履歴保存
 * 10 最終返信
 */

const { log, error: logError } = require("../../utils/logger");
const { insertAd } = require("../../ads/adService");
const { success, fail } = require("../../utils/serviceResponse");

const {
  saveConversationHistory,
  getConversationHistory,
} = require("../historyService");

const {
  buildSystemPrompt,
  buildOpenAIMessages,
} = require("./promptBuilder");

const { callOpenAI, OPENAI_MODEL } = require("./openaiClient");

const { parseOpenAIResponse } = require("./responseParser");

const { classifyMessage } = require("./classifyMessage");

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
 * messageService メイン処理
 *
 * handler から呼ばれる
 */
async function processMessage(context) {
  /**
   * context安全展開
   *
   * ADR014:
   * text       = 保存用の生発言
   * aiInputText = AI入力専用テキスト
   */
  const {
    rid = "no_rid",
    bot_id = "voice-ai-dashboard",
    userId = "",
    text = "",
    aiInputText = "",
    tone = "polite",
  } = context || {};

  const effectiveAiInputText = aiInputText || text;

  try {
    /**
     * 1
     * systemPrompt 構築
     */
    const systemPrompt = await buildSystemPrompt({
      tone,
      rid,
      log,
    });

    /**
     * 2
     * 会話履歴取得
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
     * ADR014:
     * OpenAIへ渡すのは aiInputText
     * 保存用 text はここでは使わない
     */
    const messages = buildOpenAIMessages({
      systemPrompt,
      historyItems,
      text: effectiveAiInputText,
    });

    log(`🧠 [${rid}] OpenAI messages built`, {
      messageCount: messages.length,
      historyCount: historyItems.length,
      userTextLength: String(text || "").length,
      aiInputTextLength: String(effectiveAiInputText || "").length,
    });

    /**
     * 4
     * OpenAI 呼び出し
     */
    const response = await callOpenAI({
      systemPrompt,
      text: effectiveAiInputText,
      messages,
      rid,
      log,
    });

    /**
     * 5
     * usageログ保存
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
     * AIレスポンス解析
     */
    const parsedResult = parseOpenAIResponse(
      response,
      effectiveAiInputText,
      rid,
      log
    );

    /**
     * 7
     * AI分類
     */
    const classified = classifyMessage({
      parsed: parsedResult.parsed,
    });

    const parsed = classified.parsed;
    const replyText = parsedResult.replyText;

    /**
     * 8
     * voiceログ保存
     *
     * ADR014:
     * ログ保存もユーザー生発言 text を使う
     */
    await saveVoiceLog({
      parsed,
      text,
      rid,
      log,
      logError,
    });

    /**
     * 9
     * 広告挿入
     */
    let finalReply = buildReplyText(replyText);

    finalReply = await insertAd(finalReply);

    finalReply = buildReplyText(finalReply);

    /**
     * 10
     * 会話履歴保存
     *
     * ADR014:
     * conversation_history には生発言のみ保存
     * AI入力コンテキストは保存しない
     */
    await saveConversationHistory({
      botId: bot_id,
      userId,
      userMessage: text,
      sourceType: "user_message",
    });

    await saveConversationHistory({
      botId: bot_id,
      userId,
      aiReply: finalReply,
      sourceType: "ai_reply",
    });

    /**
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
 *
 * messageService の公開API
 */
module.exports = {
  processMessage,
};