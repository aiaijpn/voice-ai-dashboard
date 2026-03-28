"use strict";

const { log, error: logError } = require("../../utils/logger");
const { insertAd } = require("../../ads/adService");
const { success, fail } = require("../../utils/serviceResponse");

const {
  saveConversationHistory,
  getConversationHistory,
} = require("../historyService");

const { buildAiContext } = require("./buildAiContext");
const { handleAnswerRule } = require("./answerRuleHandler");

const { callOpenAI, OPENAI_MODEL } = require("./openaiClient");
const { parseOpenAIResponse } = require("./responseParser");
const { classifyMessage } = require("./classifyMessage");
const { saveUsage, saveVoiceLog } = require("./logSavers");

const {
  buildReplyText,
  buildProcessMessageSuccessData,
} = require("./buildReply");

/**
 * ★ V3.2
 */
const { findCompaniesForAi } = require("../companyService");
const { findCompanyWikiAnswer } = require("../companyWikiService");

/**
 * ★ 追加（未回答収集）
 */
const { saveQuestionStock } = require("../questionStockService");
const { normalizeText } = require("../../utils/textMatch");

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
     * V3.1: answerRule
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
     * ★ V3.2: companyWiki検索
     */
    let topCompany = null;

    try {
      const companyCandidates = findCompaniesForAi(text);
      topCompany = companyCandidates[0];

      if (topCompany) {
        const wikiResult = await findCompanyWikiAnswer({
          companyId: topCompany.id,
          userQuestion: text,
        });

        if (wikiResult.found && wikiResult.item?.answer_text) {
          const reply = buildReplyText(wikiResult.item.answer_text);

          return success(
            buildProcessMessageSuccessData({
              finalReply: reply,
              parsed: {},
              userId,
              bot_id,
              rid,
            }),
            "companyWiki hit"
          );
        }
      }
    } catch (e) {
      logError(`⚠️ [${rid}] companyWiki error:`, e?.message || e);
    }

    /**
     * ★ 未回答をストック（ここが収益導線）
     */
    try {
      await saveQuestionStock({
        userId,
        bot_id,
        question: text,
        normalizedQuestion: normalizeText(text),
        companyId: topCompany?.id || "",
      });
    } catch (e) {
      logError(`⚠️ [${rid}] questionStock error:`, e?.message || e);
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