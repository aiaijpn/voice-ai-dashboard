"use strict";

const { getAllCompaniesFromSheet } = require("./companySheetService");

/**
 * TRUE判定
 */
function isTrue(value) {
  const v = String(value || "").toLowerCase().trim();
  return v === "true" || v === "1";
}

/**
 * 正規化
 */
function normalize(text = "") {
  return String(text || "").toLowerCase().trim();
}

/**
 * タグ分解
 *
 * 対応:
 * - , だけでなく Japanese comma も分解
 * - 改行、スラッシュ、全角スラッシュ、読点も分解
 */
function parseTags(tags = "") {
  return String(tags || "")
    .split(/[,、\/／\n]+/)
    .map((t) => normalize(t))
    .filter(Boolean);
}

/**
 * 部分一致
 *
 * 方針:
 * - user が tag を含む
 * - tag が user を含む
 * の両方を許容
 */
function isLooseMatch(user = "", target = "") {
  const safeUser = normalize(user);
  const safeTarget = normalize(target);

  if (!safeUser || !safeTarget) {
    return false;
  }

  return safeUser.includes(safeTarget) || safeTarget.includes(safeUser);
}

/**
 * 協賛一覧
 */
async function getCompaniesForList() {
  const companyMaster = await getAllCompaniesFromSheet();

  return companyMaster
    .filter((item) => isTrue(item.show_in_html))
    .sort((a, b) => Number(a.sort_order || 9999) - Number(b.sort_order || 9999));
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
 * AI候補抽出（V3.53）
 *
 * ルール:
 * - show_in_ai が true のものだけ対象
 * - 名前一致は強く加点
 * - short_name 一致も強く加点
 * - category 一致も少し加点
 * - tags は loose match で加点
 */
async function findCompaniesForAi(userMessage = "") {
  const companyMaster = await getAllCompaniesFromSheet();
  const user = normalize(userMessage);

  if (!user) {
    return [];
  }

  const results = [];

  for (const c of companyMaster) {
    if (!isTrue(c.show_in_ai)) {
      continue;
    }

    const name = normalize(c.name);
    const shortName = normalize(c.short_name);
    const category = normalize(c.category);
    const tags = parseTags(c.tags);

    let score = 0;

    /**
     * 1. 名前一致
     */
    if (isLooseMatch(user, name)) {
      score += 3;
    }

    /**
     * 2. short_name 一致
     */
    if (isLooseMatch(user, shortName)) {
      score += 3;
    }

    /**
     * 3. category 一致
     */
    if (isLooseMatch(user, category)) {
      score += 1;
    }

    /**
     * 4. tags 一致
     */
    for (const tag of tags) {
      if (isLooseMatch(user, tag)) {
        score += 1;
      }
    }

    /**
     * 5. 最低1点あれば候補採用
     */
    if (score > 0) {
      results.push({
        ...c,
        tags, // 配列化した tags を持たせる
        show_in_ai: isTrue(c.show_in_ai),
        show_in_html: isTrue(c.show_in_html),
        sort_order: Number(c.sort_order || 9999),
        priority: Number(c.priority || 0),
        score,
      });
    }
  }

  /**
   * 並び順
   * 1. score 高い順
   * 2. priority 高い順
   * 3. sort_order 小さい順
   */
  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }

    return a.sort_order - b.sort_order;
  });

  return results;
}

module.exports = {
  getCompaniesForList,
  getCompanyById,
  findCompaniesForAi,
};