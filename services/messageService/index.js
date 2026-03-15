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
  mapHistoryItemToOpenAIMessages,
  buildHistoryMessages,
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

log("📦 messageService/index.js loaded:", new Date().toISOString());
log("🔧 ENV CHECK (service/index)");
log(" - OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "OK" : "MISSING");
log(" - OPENAI_MODEL:", process.env.OPENAI_MODEL || "gpt-4o-mini");

async function processMessage(context) {
  const {
    rid = "no_rid",
    bot_id = "voice-ai-dashboard",
    userId = "",
    text = "",
    tone = "polite",
  } = context || {};

  try {
    const systemPrompt = await buildSystemPrompt({
      tone,
      rid,
      log,
    });

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

    const response = await callOpenAI({
      systemPrompt,
      text,
      messages,
      rid,
      log,
    });

    await saveUsage({
      response,
      bot_id,
      rid,
      openaiModel: OPENAI_MODEL,
      log,
      logError,
    });

    const parsedResult = parseOpenAIResponse(response, text, rid, log);

    const classifiedResult = classifyMessage({
      parsed: parsedResult.parsed,
    });

    const parsed = classifiedResult.parsed;
    const replyText = parsedResult.replyText;

    log(`✅ [${rid}] AI reply generated`, {
      botId: bot_id,
      userId,
      category: classifiedResult.category,
      urgency_score: classifiedResult.urgency_score,
    });

    await saveVoiceLog({
      parsed,
      text,
      rid,
      log,
      logError,
    });

    let finalReply = buildReplyText(replyText);
    finalReply = await insertAd(finalReply);
    finalReply = buildReplyText(finalReply);

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
  mapHistoryItemToOpenAIMessages,
  buildHistoryMessages,
  buildOpenAIMessages,
};