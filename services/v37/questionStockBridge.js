"use strict";

/**
 * services/v37/questionStockBridge.js
 *
 * 役割:
 * - wiki_miss のときだけ question_stock 保存
 * - companyId がある場合のみ保存
 */

const questionStockService = require("../questionStockService");
const { normalizeText } = require("../../utils/textMatch");

async function saveQuestionStockIfNeeded({
  replyMode,
  bot_id,
  userId,
  userMessage,
  companyId,
}) {
  console.log("[V37][questionStockBridge] ENTER", {
    replyMode,
    bot_id,
    userId,
    userMessage,
    companyId,
  });

  if (replyMode !== "wiki_miss") {
    console.log("[V37][questionStockBridge] SKIP: replyMode is not wiki_miss");
    return;
  }

  if (!companyId) {
    console.log("[V37][questionStockBridge] SKIP: companyId missing");
    return;
  }

  const normalizedQuestion = normalizeText(userMessage);

  console.log("[V37][questionStockBridge] NORMALIZED", {
    userMessage,
    normalizedQuestion,
  });

  if (!normalizedQuestion) {
    console.log("[V37][questionStockBridge] SKIP: normalizedQuestion missing");
    return;
  }

  try {
    const saveResult = await questionStockService.saveQuestionStock({
      user_id: userId,
      bot_id,
      question: userMessage,
      normalized_question: normalizedQuestion,
      company_id: companyId,
      user_question: userMessage,
    });

    console.log("[V37][questionStockBridge] SAVE RESULT", saveResult);
  } catch (error) {
    console.error("[V37][questionStockBridge] SAVE ERROR", {
      message: error?.message || String(error),
      stack: error?.stack || "",
    });
  }
}

module.exports = {
  saveQuestionStockIfNeeded,
};