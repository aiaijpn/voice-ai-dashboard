"use strict";

/**
 * classifyMessage
 *
 * 役割
 * AI parsed JSON から
 *
 * - summary
 * - category
 * - urgency_score
 *
 * を安全に正規化する
 *
 * このファイルは
 * 「AI意味解析の安全層」
 *
 * OpenAIの返却は不安定なので
 * 型・範囲をここで保証する
 */

/**
 * summary 正規化
 *
 * @param {any} value
 * @returns {string}
 */
function normalizeSummary(value) {

  return String(value || "").trim();

}

/**
 * category 正規化
 *
 * 0〜4のみ許可
 *
 * 0 対象外
 * 1 売上集客
 * 2 顧客対応
 * 3 業務効率
 * 4 経営判断
 *
 * @param {any} value
 * @returns {number|null}
 */
function normalizeCategory(value) {

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const num = Number(value);

  if (!Number.isInteger(num)) {
    return null;
  }

  if (num < 0 || num > 4) {
    return null;
  }

  return num;

}

/**
 * urgency_score 正規化
 *
 * 内部:
 * 1〜9
 *
 * @param {any} value
 * @returns {number|null}
 */
function normalizeUrgencyScore(value) {

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const num = Number(value);

  if (!Number.isFinite(num)) {
    return null;
  }

  const rounded = Math.round(num);

  if (rounded < 1) return 1;
  if (rounded > 9) return 9;

  return rounded;

}

/**
 * parsed JSON を正規化する
 *
 * @param {Object} context
 * @returns {Object}
 */
function classifyMessage(context = {}) {

  const parsed = context.parsed || {};

  const summary = normalizeSummary(parsed.summary);

  const category = normalizeCategory(parsed.category);

  const urgency_score = normalizeUrgencyScore(parsed.urgency_score);

  return {
    ...context,

    parsed: {
      ...parsed,
      summary,
      category,
      urgency_score,
    },

    summary,
    category,
    urgency_score,
  };
}

module.exports = {
  classifyMessage,
  normalizeSummary,
  normalizeCategory,
  normalizeUrgencyScore,
};