"use strict";

const { log, error: logError } = require("../../utils/logger");
const { success, fail } = require("../../utils/serviceResponse");

const {
  saveConversationHistory,
  getConversationHistory,
  getLatestCompanyIdFromHistory,
} = require("../historyService");

const { handleAnswerRule } = require("./answerRuleHandler");

const {
  buildReplyText,
  buildProcessMessageSuccessData,
} = require("./buildReply");

/**
 * ★ V3.2 / V3.4
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

/**
 * company 候補から上位1件を返す
 *
 * @param {string} text
 * @returns {Object|null}
 */
function findTopCompanyFromText(text = "") {
  const companyCandidates = findCompaniesForAi(text);
  return Array.isArray(companyCandidates) && companyCandidates.length > 0
    ? companyCandidates[0]
    : null;
}

/**
 * 履歴 companyId と今回推定結果から
 * 最終 company を決める
 *
 * 優先順位:
 * 1. 履歴の companyId
 * 2. 今回の推定
 * 3. null
 *
 * @param {string|null} historyCompanyId
 * @param {Object|null} currentTopCompany
 * @returns {Object}
 */
function resolveActiveCompany(historyCompanyId, currentTopCompany) {
  const safeHistoryCompanyId = String(historyCompanyId || "").trim();

  if (safeHistoryCompanyId) {
    return {
      companyId: safeHistoryCompanyId,
      source: "history",
    };
  }

  if (currentTopCompany && currentTopCompany.id) {
    return {
      companyId: currentTopCompany.id,
      source: "current_text",
    };
  }

  return {
    companyId: "",
    source: "none",
  };
}

async function processMessage(context) {
  const {
    rid = "no_rid",
    bot_id = "voice-ai-dashboard",
    userId = "",
    text = "",
  } = context || {};

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
     * 2. 履歴から最新 companyId を取得
     */
    let historyCompanyId = "";

    try {
      const latestCompanyResult = await getLatestCompanyIdFromHistory({
        botId: bot_id,
        userId,
        limit: 10,
      });

      if (latestCompanyResult.success) {
        historyCompanyId = String(
          latestCompanyResult.data?.companyId || ""
        ).trim();
      }

      log(`🧪 [${rid}] historyCompanyId`, historyCompanyId || "(none)");
    } catch (e) {
      logError(
        `⚠️ [${rid}] getLatestCompanyIdFromHistory error:`,
        e?.message || e
      );
    }

    /**
     * 3. 今回入力から company 推定
     */
    let currentTopCompany = null;

    try {
      currentTopCompany = findTopCompanyFromText(text);
      log(`🧪 [${rid}] currentTopCompany`, currentTopCompany?.id || "(none)");
    } catch (e) {
      logError(`⚠️ [${rid}] findTopCompanyFromText error:`, e?.message || e);
    }

    /**
     * 4. 履歴優先で active company 決定
     */
    const activeCompany = resolveActiveCompany(
      historyCompanyId,
      currentTopCompany
    );
    const activeCompanyId = String(activeCompany.companyId || "").trim();

    log(`🧪 [${rid}] activeCompany`, {
      activeCompanyId,
      source: activeCompany.source,
      historyItemsCount: historyItems.length,
    });


    /**
     * 6. companyWiki検索
     */
    if (activeCompanyId) {
      try {
        const wikiResult = await findCompanyWikiAnswer({
          companyId: activeCompanyId,
          userQuestion: text,
        });

        if (wikiResult.found && wikiResult.item?.answer_text) {
          const reply = buildReplyText(wikiResult.item.answer_text);

          await saveConversationHistory({
            botId: bot_id,
            userId,
            userMessage: text,
            sourceType: "user_message",
            companyId: activeCompanyId,
          });

          await saveConversationHistory({
            botId: bot_id,
            userId,
            aiReply: reply,
            sourceType: "ai_reply",
            companyId: activeCompanyId,
          });

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
      } catch (e) {
        logError(`⚠️ [${rid}] companyWiki error:`, e?.message || e);
      }
    }


    /**
     * 5. answerRule
     * ※ V3.4では company 決定の後に動かす
     *    answerRule ヒット時も companyId を履歴保存する
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
      const replyText = String(ruleResult.response?.data?.replyText || "");

      await saveConversationHistory({
        botId: bot_id,
        userId,
        userMessage: text,
        sourceType: "user_message",
        companyId: activeCompanyId,
      });

      await saveConversationHistory({
        botId: bot_id,
        userId,
        aiReply: replyText,
        sourceType: "ai_reply",
        companyId: activeCompanyId,
      });

      return ruleResult.response;
    }




    /**
     * 7. 未回答ストック
     * - companyId が確定していてWiki未登録
     * - または companyId 不明
     */
    try {
      const questionStockInput = {
        user_id: userId,
        bot_id,
        question: text,
        normalized_question: normalizeText(text),
        company_id: activeCompanyId,
        user_question: text,
      };

      log(`🧪 [${rid}] questionStock input`, questionStockInput);

      const questionStockResult = await saveQuestionStock(questionStockInput);

      log(`🧪 [${rid}] questionStock result`, questionStockResult);
    } catch (e) {
      logError(`⚠️ [${rid}] questionStock error:`, e?.message || e);
    }

    /**
     * 8. 固定フォールバック返信
     */
    const finalReply = buildReplyText(WIKI_NOT_FOUND_REPLY);

    /**
     * 9. 履歴保存
     */
    await saveConversationHistory({
      botId: bot_id,
      userId,
      userMessage: text,
      sourceType: "user_message",
      companyId: activeCompanyId,
    });

    await saveConversationHistory({
      botId: bot_id,
      userId,
      aiReply: finalReply,
      sourceType: "ai_reply",
      companyId: activeCompanyId,
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