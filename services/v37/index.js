"use strict";

const { success, fail } = require("../../utils/serviceResponse");

const { resolveCompany } = require("./resolveCompany");
const { resolveReplyMode } = require("./resolveReplyMode");
const { buildReply } = require("./buildReply");
const { saveQuestionStockIfNeeded } = require("./questionStockBridge");

const companyWikiService = require("../companyWikiService");

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
}) {
  try {
    const companyResult = await resolveCompany({
      rid,
      bot_id,
      userId,
      userMessage,
      conversationHistory,
    });

    let wikiAnswer = null;

    if (companyResult.resolvedCompanyId) {
      const cleanedQuestion = stripCompanyName(
        userMessage,
        companyResult.resolvedCompanyId
      );

      const wikiResult = await companyWikiService.findCompanyWikiAnswer({
        companyId: companyResult.resolvedCompanyId,
        userQuestion: cleanedQuestion,
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