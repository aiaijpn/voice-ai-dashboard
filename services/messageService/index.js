"use strict";

/**
 * messageService / index
 *
 * このファイルは messageService の「司令塔」です。
 *
 * ADR016 対応版
 * 2026-03-15
 *
 * 目的
 * - 処理フローのオーケストレーション
 * - 各モジュールの呼び出し
 * - AI入力構築責務を promptBuilder に委譲
 * - 保存データとAI入力コンテキストの責務分離を維持
 *
 * このファイルでやらないこと
 * - OpenAI API 呼び出し実装
 * - JSON解析
 * - AI分類処理
 * - Google Sheets API 呼び出し
 * - 会話履歴保存の内部処理
 * - systemPrompt生成
 * - OpenAI messages生成
 *
 * それらはすべて専用モジュールへ委譲する
 *
 * 処理フロー
 *
 * 1 会話履歴取得
 * 2 buildAiContext で AI入力構築
 * 3 OpenAI 呼び出し
 * 4 AIレスポンス解析
 * 5 AI分類
 * 6 voiceログ保存
 * 7 広告挿入
 * 8 会話履歴保存
 * 9 最終返信
 */

const { log, error: logError } = require("../../utils/logger");
const { insertAd } = require("../../ads/adService");
const { success, fail } = require("../../utils/serviceResponse");

const {
  saveConversationHistory,
  getConversationHistory,
} = require("../historyService");

const { buildAiContext } = require("./buildAiContext");

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
   * text        = 保存用の生発言
   * aiInputText = AI入力専用テキスト
   *
   * ADR016:
   * AI入力構築は promptBuilder に委譲
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
     * 2
     * buildAiContext で AI入力構築
     *
     * V3:
     * - 関連企業候補抽出
     * - promptBuilder へ companyCandidates 連携
     */
    const promptContext = await buildAiContext({
      rid,
      tone,
      historyItems,
      userText: effectiveAiInputText,
      log,
    });

    const { systemPrompt, messages, companyCandidates } = promptContext;

    log(`🧠 [${rid}] prompt context ready`, {
      historyCount: historyItems.length,
      messageCount: messages.length,
      userTextLength: String(text || "").length,
      aiInputTextLength: String(effectiveAiInputText || "").length,
      companyCandidatesCount: Array.isArray(companyCandidates)
        ? companyCandidates.length
        : 0,
    });

    /**
     * 3
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
     * 4
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
     * 5
     * AIレスポンス解析
     */
    const parsedResult = parseOpenAIResponse(
      response,
      effectiveAiInputText,
      rid,
      log
    );

    /**
     * 6
     * AI分類
     */
    const classified = classifyMessage({
      parsed: parsedResult.parsed,
    });

    const parsed = classified.parsed;
    const replyText = parsedResult.replyText;

    /**
     * 7
     * voiceログ保存
     *
     * ADR014:
     * ログ保存はユーザー生発言 text を使う
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

    //finalReply = await insertAd(finalReply);

    finalReply = buildReplyText(finalReply);

    /**
     * 9
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