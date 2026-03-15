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
 * - parsed から summary / category / urgency_score を安全に取り出す
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
    summary: parsed?.summary || "",
    category: parsed?.category ?? null,
    urgency_score: parsed?.urgency_score ?? null,
    userId,
    bot_id,
    rid,
  };
}

module.exports = {
  buildReplyText,
  buildProcessMessageSuccessData,
};