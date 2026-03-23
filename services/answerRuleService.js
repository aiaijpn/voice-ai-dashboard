"use strict";

/**
 * answerRuleService
 *
 * 役割:
 * - ユーザー発話に対して answerRules を照合する
 * - 一致したルールの中から最優先1件を返す
 *
 * 方針:
 * - V3.1では軽量一致に徹する
 * - answerRules のデータ定義は data 側に置く
 * - 一致判定は utils/textMatch.js を流用する
 */

const { answerRules } = require("../data/answerRules");
const { normalizeText, matchesKeywords } = require("../utils/textMatch");

/**
 * 有効な回答優先ルールのみ取得
 *
 * @returns {Array}
 */
function getActiveAnswerRules() {
  return answerRules.filter((rule) => rule && rule.is_active === true);
}

/**
 * ユーザー発話に一致するルールだけ返す
 *
 * 並び順:
 * 1. priority 降順
 * 2. trigger_keywords 数 降順
 *
 * @param {string} userMessage
 * @returns {Array}
 */
function findMatchedAnswerRules(userMessage = "") {
  const normalizedMessage = normalizeText(userMessage);

  if (!normalizedMessage) {
    return [];
  }

  return getActiveAnswerRules()
    .filter((rule) => {
      return matchesKeywords(normalizedMessage, rule.trigger_keywords);
    })
    .sort((a, b) => {
      const priorityA = Number(a?.priority || 0);
      const priorityB = Number(b?.priority || 0);

      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }

      const keywordCountA = Array.isArray(a?.trigger_keywords)
        ? a.trigger_keywords.length
        : 0;
      const keywordCountB = Array.isArray(b?.trigger_keywords)
        ? b.trigger_keywords.length
        : 0;

      return keywordCountB - keywordCountA;
    });
}

/**
 * 最優先の回答優先ルール1件を返す
 *
 * @param {string} userMessage
 * @returns {Object|null}
 */
function findAnswerRule(userMessage = "") {
  const matchedRules = findMatchedAnswerRules(userMessage);

  if (!Array.isArray(matchedRules) || matchedRules.length === 0) {
    return null;
  }

  return matchedRules[0];
}

module.exports = {
  getActiveAnswerRules,
  findMatchedAnswerRules,
  findAnswerRule,
};