"use strict";

/**
 * textMatch
 *
 * 役割:
 * - ユーザー入力と企業タグの簡易一致判定
 * - V3では「軽い前処理 + includes」のみ
 *
 * 方針:
 * - 複雑化しない
 * - あいまい検索しない
 * - まずは最小一致で動かす
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
 * ユーザー発言が tags のどれかを含むか判定
 *
 * @param {string} userMessage
 * @param {string[]} tags
 * @returns {boolean}
 */
function matchesCompanyTags(userMessage = "", tags = []) {
  const normalizedMessage = normalizeText(userMessage);

  if (!normalizedMessage) {
    return false;
  }

  if (!Array.isArray(tags) || tags.length === 0) {
    return false;
  }

  return tags.some((tag) => {
    const normalizedTag = normalizeText(tag);
    if (!normalizedTag) {
      return false;
    }
    return normalizedMessage.includes(normalizedTag);
  });
}

module.exports = {
  normalizeText,
  matchesCompanyTags,
};