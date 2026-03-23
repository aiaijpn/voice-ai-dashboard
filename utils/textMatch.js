"use strict";

/**
 * textMatch
 *
 * 役割:
 * - ユーザー入力とキーワードの簡易一致判定
 * - company / answerRules 両方で使う共通ロジック
 *
 * 方針:
 * - 複雑化しない
 * - あいまい検索しない
 * - 軽い前処理 + includes のみ
 */

/**
 * テキスト正規化
 *
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text = "") {
  return String(text)
    .trim()
    .toLowerCase();
}

/**
 * 汎用キーワード一致判定
 *
 * @param {string} userMessage
 * @param {string[]} keywords
 * @returns {boolean}
 */
function matchesKeywords(userMessage = "", keywords = []) {
  const normalizedMessage = normalizeText(userMessage);

  if (!normalizedMessage) {
    return false;
  }

  if (!Array.isArray(keywords) || keywords.length === 0) {
    return false;
  }

  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeText(keyword);
    if (!normalizedKeyword) {
      return false;
    }
    return normalizedMessage.includes(normalizedKeyword);
  });
}

/**
 * 企業タグ一致判定（後方互換）
 *
 * @param {string} userMessage
 * @param {string[]} tags
 * @returns {boolean}
 */
function matchesCompanyTags(userMessage = "", tags = []) {
  return matchesKeywords(userMessage, tags);
}

module.exports = {
  normalizeText,
  matchesKeywords,
  matchesCompanyTags,
};