"use strict";

/**
 * messageService / buildReply
 *
 * 役割:
 * - AI応答テキストを最終返信用に整形する
 * - processMessage の success.data を組み立てる
 *
 * このファイルでやること:
 * - replyText の安全化
 * - parsed から必要項目を安全に取り出す
 *
 * このファイルでやらないこと:
 * - OpenAI 呼び出し
 * - 広告挿入
 * - ログ保存
 * - 会話履歴保存
 */

/**
 * AI応答テキストを安全に整形する
 *
 * @param {string} replyText
 * @returns {string}
 */
function buildReplyText(replyText = "") {
  const text = String(replyText || "").trim();

  if (!text) {
    return "ありがとうございます。内容を受け取りました。";
  }

  return text;
}

/**
 * processMessage success.data を組み立てる
 *
 * @param {Object} input
 * @param {string} input.finalReply
 * @param {Object} input.parsed
 * @param {string} input.userId
 * @param {string} input.bot_id
 * @param {string} input.rid
 * @returns {Object}
 */
function buildProcessMessageSuccessData(input = {}) {
  const finalReply = buildReplyText(input.finalReply || "");
  const parsed = input.parsed || {};
  const userId = String(input.userId || "");
  const bot_id = String(input.bot_id || "");
  const rid = String(input.rid || "");

  return {
    replyText: finalReply,

    // V3.6 会話継続で必要な返却値
    topicLabel: String(parsed.topicLabel || "").trim(),
    companyId: String(parsed.companyId || "").trim(),
    matchedCompanyId: String(
      parsed.matchedCompanyId || parsed.companyId || ""
    ).trim(),

    isConversationContinuing: Boolean(parsed.isConversationContinuing),
    currentCompanyId: String(parsed.currentCompanyId || "").trim(),

    conversationHistoryCount:
      Number.isFinite(Number(parsed.conversationHistoryCount))
        ? Number(parsed.conversationHistoryCount)
        : null,

    // 既存の返却値
    summary: parsed.summary || "",
    category: parsed.category ?? null,
    urgency_score: parsed.urgency_score ?? null,

    userId,
    bot_id,
    rid,
  };
}

module.exports = {
  buildReplyText,
  buildProcessMessageSuccessData,
};