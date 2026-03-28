"use strict";

const { log, error: logError } = require("../../utils/logger");
const { success, fail } = require("../../utils/serviceResponse");

const {
  saveConversationHistory,
  getConversationHistory,
} = require("../historyService");

const { handleAnswerRule } = require("./answerRuleHandler");

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
 * ★ 未回答収集
 */
const { saveQuestionStock } = require("../questionStockService");
const { normalizeText } = require("../../utils/textMatch");

/**
 * ★ 固定フォールバック
 */
const WIKI_NOT_FOUND_REPLY =
  "そのご質問についての情報は現在登録されておりません。\nお時間いただきますが、お調べいたします。";

log("📦 messageService/index.js loaded:", new Date().toISOString());

async function processMessage(context) {
  const {
    rid = "no_rid",
    bot_id = "voice-ai-dashboard",
    userId = "",
    text = "",
  } = context || {};

  try {
    /**
     * 1. 会話履歴（今は使わないが維持）
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
     * 2. answerRule
     */
    const ruleResult = await handleAnswerRule({
      rid,
      bot_id,
      userId,
      text,
      aiInputText: text,
      log,
      logError,
    });

    if (ruleResult.handled) {
      return ruleResult.response;
    }

    /**
     * 3. companyWiki検索
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
     * 4. 未回答ストック（必ず実行）
     */
    try {
      const questionStockInput = {
        user_id: userId,
        bot_id,
        question: text,
        normalized_question: normalizeText(text),
        company_id: topCompany?.id || "",
        user_question: text,
      };

      log(`🧪 [${rid}] questionStock input`, questionStockInput);

      const questionStockResult = await saveQuestionStock(questionStockInput);

      log(`🧪 [${rid}] questionStock result`, questionStockResult);
    } catch (e) {
      logError(`⚠️ [${rid}] questionStock error:`, e?.message || e);
    }

    /**
     * 5. 固定フォールバック返信
     */
    const finalReply = buildReplyText(WIKI_NOT_FOUND_REPLY);

    /**
     * 6. 履歴保存
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
        parsed: {},
        userId,
        bot_id,
        rid,
      }),
      "fallback reply"
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