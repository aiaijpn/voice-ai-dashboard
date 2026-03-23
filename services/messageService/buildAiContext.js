"use strict";

/**
 * buildAiContext
 *
 * 役割:
 * - ユーザー発話から関連企業候補を抽出
 * - promptBuilder へ companyCandidates を渡して
 *   OpenAI入力コンテキストを構築する
 *
 * 方針:
 * - V3では最大2件まで
 * - 企業候補が無い場合でも通常会話は成立させる
 * - index.js は司令塔として薄く保つ
 */

const { findCompaniesForAi } = require("../companyService");
const { buildPromptContext } = require("./promptBuilder");

/**
 * AI入力コンテキスト構築
 *
 * @param {Object} input
 * @param {string} input.rid
 * @param {string} input.tone
 * @param {Array} input.historyItems
 * @param {string} input.userText
 * @param {Function} input.log
 * @returns {Promise<{systemPrompt: string, messages: Array, companyCandidates: Array}>}
 */
async function buildAiContext(input = {}) {
  const rid = String(input.rid || "no_rid");
  const tone = String(input.tone || "polite");
  const historyItems = Array.isArray(input.historyItems) ? input.historyItems : [];
  const userText = String(input.userText || "");
  const log = typeof input.log === "function" ? input.log : console.log;

  const companyCandidates = findCompaniesForAi(userText).slice(0, 2);

  log(`🏢 [${rid}] companyCandidates count=${companyCandidates.length}`);

  if (companyCandidates.length > 0) {
    log(
      `🏢 [${rid}] companyCandidates=${companyCandidates
        .map((item) => item.display_name)
        .join(" | ")}`
    );
  }

  const promptContext = await buildPromptContext({
    rid,
    tone,
    historyItems,
    userText,
    log,
    companyCandidates,
  });

  return {
    ...promptContext,
    companyCandidates,
  };
}

module.exports = {
  buildAiContext,
};