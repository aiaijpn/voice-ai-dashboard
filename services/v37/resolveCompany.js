"use strict";

/**
 * services/v37/resolveCompany.js
 *
 * V37:
 * - AI判定なし
 * - V35の前処理のみ使う
 * - companyCandidates ベースで確定判定する
 * - 確定できなければ clarification
 */

const { collectV35Context } = require("../v35/collectV35Context");
const {
  shouldSkipJudgeAI,
  normalizeCompanyId,
} = require("../v35/companyJudgeService");

async function resolveCompany({
  rid,
  bot_id,
  userId,
  userMessage,
  conversationHistory = [],
}) {
  const contextResult = await collectV35Context({
    rid,
    userMessage,
    conversationHistory,
  });

  if (!contextResult?.success) {
    return {
      resolvedCompanyId: null,
      needsClarification: true,
      currentCompanyId: null,
      companyCandidates: [],
      isConversationContinuing: false,
    };
  }

  const context = contextResult.data || {};
  const companyCandidates = Array.isArray(context.companyCandidates)
    ? context.companyCandidates
    : [];

  /**
   * V37:
   * 今回メッセージ由来の候補が無ければ clarification
   */
  if (companyCandidates.length === 0) {
    return {
      resolvedCompanyId: null,
      needsClarification: true,
      currentCompanyId: null,
      companyCandidates: [],
      isConversationContinuing: false,
    };
  }

  /**
   * code判定のみ使用
   */
  const judge = shouldSkipJudgeAI(context);
  const resolvedCompanyId = normalizeCompanyId(judge?.matchedCompanyId || "");

  /**
   * 強い候補があっても matchedCompanyId が空なら clarification
   */
  if (!resolvedCompanyId) {
    return {
      resolvedCompanyId: null,
      needsClarification: true,
      currentCompanyId: null,
      companyCandidates,
      isConversationContinuing: Boolean(context.isConversationContinuing),
    };
  }

  return {
    resolvedCompanyId,
    needsClarification: false,
    currentCompanyId: resolvedCompanyId,
    companyCandidates,
    isConversationContinuing: Boolean(context.isConversationContinuing),
  };
}

module.exports = {
  resolveCompany,
};