"use strict";

const { success, fail } = require("../../utils/serviceResponse");

const { resolveCompany } = require("./resolveCompany");
const { resolveReplyMode } = require("./resolveReplyMode");
const { buildReply } = require("./buildReply");
const { saveQuestionStockIfNeeded } = require("./questionStockBridge");

const companyWikiService = require("../companyWikiService");
const { resolveFaqIntent } = require("../faqIntentResolver");

function stripCompanyName(text = "", companyId = "") {
  if (!text || !companyId) return text;

  // 最小対応（必要なら後で強化）
  return text.replace(/スーツ金井|オーダースーツ金井/g, "").trim();
}

async function runV37({
  rid,
  bot_id,
  userId,
  userMessage,
  conversationHistory = [],
  forcedTheme = "",
}) {
  try {
    let companyResult = null;

    if (forcedTheme) {
      companyResult = {
        resolvedCompanyId: String(forcedTheme).trim(),
        needsClarification: false,
        topicLabel: "",
        isConversationContinuing: true,
      };
    } else {
      companyResult = await resolveCompany({
        rid,
        bot_id,
        userId,
        userMessage,
        conversationHistory,
      });
    }

    let wikiAnswer = null;
    let cleanedQuestion = "";
    let wikiResult = null;
    let faqIntent = null;

    if (companyResult.resolvedCompanyId) {
      cleanedQuestion = stripCompanyName(
        userMessage,
        companyResult.resolvedCompanyId
      );
      faqIntent = resolveFaqIntent(cleanedQuestion);

      wikiResult = await companyWikiService.findCompanyWikiAnswer({
        companyId: companyResult.resolvedCompanyId,
        userQuestion: cleanedQuestion,
        faqKey: faqIntent.matched ? faqIntent.faqKey : "",
      });

      console.log("### V37 WIKI DEBUG ###", {
        rid,
        resolvedCompanyId: companyResult.resolvedCompanyId || "",
        userMessage: String(userMessage || ""),
        cleanedQuestion,
        faqKey: faqIntent?.matched ? faqIntent.faqKey : "",
        wikiFound: Boolean(wikiResult?.found),
        wikiItemCompanyId: String(wikiResult?.item?.company_id || ""),
        wikiItemStatus: String(wikiResult?.item?.status || ""),
        wikiItemQuestionPattern: String(wikiResult?.item?.question_pattern || ""),
        wikiItemNormalizedQuestion: String(
          wikiResult?.item?.normalized_question || ""
        ),
        wikiItemAnswerLength: String(wikiResult?.item?.answer_text || "").trim()
          .length,
      });

      if (wikiResult?.found && wikiResult?.item?.answer_text) {
        wikiAnswer = String(wikiResult.item.answer_text).trim();
      }
    }

    const replyMode = resolveReplyMode({
      resolvedCompanyId: companyResult.resolvedCompanyId,
      needsClarification: companyResult.needsClarification,
      wikiAnswer,
    });

    console.log("### V37 REPLY MODE DEBUG ###", {
      rid,
      resolvedCompanyId: companyResult.resolvedCompanyId || "",
      userMessage: String(userMessage || ""),
      cleanedQuestion,
      faqKey: faqIntent?.matched ? faqIntent.faqKey : "",
      wikiFound: Boolean(wikiResult?.found),
      wikiItemCompanyId: String(wikiResult?.item?.company_id || ""),
      wikiItemStatus: String(wikiResult?.item?.status || ""),
      wikiItemQuestionPattern: String(wikiResult?.item?.question_pattern || ""),
      wikiItemNormalizedQuestion: String(
        wikiResult?.item?.normalized_question || ""
      ),
      wikiItemAnswerLength: String(wikiResult?.item?.answer_text || "").trim()
        .length,
      replyMode,
    });

    await saveQuestionStockIfNeeded({
      replyMode,
      bot_id,
      userId,
      userMessage,
      companyId: companyResult.resolvedCompanyId,
    });

    const replyData = buildReply({
      replyMode,
      wikiAnswer,
      companyResult,
      userMessage,
    });

    return success(replyData, "v37 reply");
  } catch (error) {
    return fail(error?.message || "runV37 failed", null);
  }
}

module.exports = {
  runV37,
};
