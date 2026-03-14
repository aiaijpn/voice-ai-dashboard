"use strict";

/**
 * messageService / index
 *
 * このファイルは messageService の「司令塔」です。
 *
 * 役割:
 * - ユーザメッセージを受け取り
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
 *
 * このファイルでやらないこと:
 * - OpenAI API の直接実装
 * - Google Sheets API 呼び出し
 * - 会話履歴保存の内部処理
 *
 * それらはそれぞれ別モジュールへ委譲します。
 */

const { log, error: logError } = require("../../utils/logger");
const { insertAd } = require("../../ads/adService");
const { success, fail } = require("../../utils/serviceResponse");

/**
 * ADR-008
 * 会話履歴保存 service
 */
const { saveConversationHistory } = require("../historyService");

/**
 * messageService 内部分割モジュール
 */
const { buildSystemPrompt } = require("./promptBuilder");
const { callOpenAI, OPENAI_MODEL } = require("./openaiClient");
const { parseOpenAIResponse } = require("./responseParser");
const { saveUsage, saveVoiceLog } = require("./logSavers");

/**
 * 起動ログ
 */
log("📦 messageService/index.js loaded:", new Date().toISOString());
log("🔧 ENV CHECK (service/index)");
log(" - OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "OK" : "MISSING");
log(" - OPENAI_MODEL:", process.env.OPENAI_MODEL || "gpt-4o-mini");

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
     * OpenAI 呼び出し
     */
    const response = await callOpenAI({
      systemPrompt,
      text,
      rid,
      log,
    });

    /**
     * 3
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
     * 4
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

    /**
     * 5
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
     * 6
     * 広告挿入
     */
    let finalReply = replyText;
    finalReply = await insertAd(finalReply);

    /**
     * 7
     * 会話履歴保存
     *
     * ADR-008
     */
    const historyResult = await saveConversationHistory({
      botId: bot_id,
      userId,
      userMessage: text,
      aiReply: finalReply,
      sourceType: "message",
    });

    /**
     * 保存結果ログ
     */
    if (!historyResult.success) {
      logError(`❌ [${rid}] saveConversationHistory failed:`, historyResult.message);
    } else {
      log(`✅ [${rid}] saveConversationHistory ok`, {
        botId: bot_id,
        userId,
        sourceType: "message",
      });
    }

    /**
     * 8
     * 最終レスポンス
     */
    return success(
      {
        replyText: finalReply,
        summary: parsed?.summary || "",
        category: parsed?.category ?? null,
        urgency_score: parsed?.urgency_score ?? null,
        userId,
        bot_id,
        rid,
      },
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
};