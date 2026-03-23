"use strict";

/**
 * messageService / index
 *
 * V3.1 対応版
 *
 * 追加:
 * - answerRuleHandler による即返し分岐
 */

const { log, error: logError } = require("../../utils/logger");
const { insertAd } = require("../../ads/adService");
const { success, fail } = require("../../utils/serviceResponse");

const {
  saveConversationHistory,
  getConversationHistory,
} = require("../historyService");

const { buildAiContext } = require("./buildAiContext");
const { handleAnswerRule } = require("./answerRuleHandler"); // ★ 追加

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

async function processMessage(context) {
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
     * 1. 会話履歴取得
     */
    let historyItems = [];

    const historyResult = await getConversationHistory({
      botId: bot_id,
      userId,
      limit: 10,
    });

    if (historyResult.success) {
      historyItems = Array.isArray(historyResult.data?.items)
        ? historyResult.data.items
        : [];
    }

    /**
     * ★ V3.1 ここが追加ポイント
     * 回答優先ルールを先にチェック
     */
    const ruleResult = await handleAnswerRule({
      rid,
      bot_id,
      userId,
      text,
      aiInputText,
      log,
      logError,
    });

    if (ruleResult.handled) {
      return ruleResult.response;
    }

    /**
     * 2. AI入力構築
     */
    const promptContext = await buildAiContext({
      rid,
      tone,
      historyItems,
      userText: effectiveAiInputText,
      log,
    });

    const { systemPrompt, messages } = promptContext;

    /**
     * 3. OpenAI呼び出し
     */
    const response = await callOpenAI({
      systemPrompt,
      text: effectiveAiInputText,
      messages,
      rid,
      log,
    });

    /**
     * 4. usage保存
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
     * 5. 解析
     */
    const parsedResult = parseOpenAIResponse(
      response,
      effectiveAiInputText,
      rid,
      log
    );

    /**
     * 6. 分類
     */
    const classified = classifyMessage({
      parsed: parsedResult.parsed,
    });

    const parsed = classified.parsed;
    const replyText = parsedResult.replyText;

    /**
     * 7. voiceログ
     */
    await saveVoiceLog({
      parsed,
      text,
      rid,
      log,
      logError,
    });

    /**
     * 8. 返信生成
     */
    let finalReply = buildReplyText(replyText);
    //finalReply = await insertAd(finalReply);
    finalReply = buildReplyText(finalReply);

    /**
     * 9. 履歴保存
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
     * 最終返却
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

module.exports = {
  processMessage,
};