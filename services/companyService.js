"use strict";

const { getAllCompaniesFromSheet } = require("./companySheetService");

/**
 * TRUE判定
 */
function isTrue(value) {
  const v = String(value || "").toLowerCase();
  return v === "true" || v === "1";
}

/**
 * 正規化
 */
function normalize(text = "") {
  return String(text).toLowerCase().trim();
}

/**
 * tags分解
 */
function parseTags(tags = "") {
  return String(tags)
    .split(",")
    .map((t) => normalize(t))
    .filter(Boolean);
}

/**
 * 協賛一覧
 */
async function getCompaniesForList() {
  const companyMaster = await getAllCompaniesFromSheet();

  return companyMaster
    .filter((item) => item.show_in_html !== "")
    .sort((a, b) => Number(a.show_in_html || 0) - Number(b.show_in_html || 0));
}

/**
 * ID取得
 */
async function getCompanyById(id = "") {
  const companyMaster = await getAllCompaniesFromSheet();
  const targetId = String(id || "").trim();

  if (!targetId) return undefined;

  return companyMaster.find((item) => item.company_id === targetId);
}

/**
 * AI候補（V3.53）
 */
async function findCompaniesForAi(userMessage = "") {
  const companyMaster = await getAllCompaniesFromSheet();
  const user = normalize(userMessage);

  const results = [];

  for (const c of companyMaster) {
    if (!isTrue(c.show_in_ai)) continue;

    const name = normalize(c.name);
    const shortName = normalize(c.short_name);
    const tags = parseTags(c.tags);

    let score = 0;

    // 名前一致
    if (user.includes(name)) score += 2;
    if (user.includes(shortName)) score += 2;

    // タグ一致
    for (const tag of tags) {
      if (user.includes(tag)) {
        score += 1;
      }
    }

    if (score > 0) {
      results.push({
        ...c,
        score,
      });
    }
  }

  /**
   * スコア順
   */
  results.sort((a, b) => b.score - a.score);

  return results;
}

module.exports = {
  getCompaniesForList,
  getCompanyById,
  findCompaniesForAi,
};