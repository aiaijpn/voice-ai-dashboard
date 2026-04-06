"use strict";

/**
 * companySheetService
 *
 * 役割:
 * - Google Sheets の company_master シートを読む
 * - 1行ずつ company オブジェクトとして返す
 * - userMessage から companyCandidates を生成する
 *
 * 方針:
 * - V3.53 最小実装
 * - ヘッダ名で安全に読む
 * - score / priority / show_in_ai で候補制御する
 */

const { google } = require("googleapis");

const SPREADSHEET_ID = String(process.env.SPREADSHEET_ID || "").trim();
const SHEET_NAME = "company_master";

/**
 * Sheets client
 */
function createSheetsClient() {
  const fs = require("fs");
  const path = require("path");

  const filePath = String(process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "").trim();
  const rawJson = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();

  let credentials = null;

  if (filePath) {
    const resolvedPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Service account file not found: ${resolvedPath}`);
    }

    credentials = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  } else if (rawJson) {
    credentials = JSON.parse(rawJson);
  } else {
    throw new Error("Google service account credentials are not set.");
  }

  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({
    version: "v4",
    auth,
  });
}

/**
 * 安全文字列化
 */
function toSafeString(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

/**
 * 数値化
 */
function toSafeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * boolean化
 * - "TRUE" / "true" / "1" / "yes" / "on" を true
 */
function toSafeBoolean(value) {
  const text = toSafeString(value).toLowerCase();
  return (
    text === "true" ||
    text === "1" ||
    text === "yes" ||
    text === "on" ||
    text === "y"
  );
}

/**
 * タグ文字列を配列化
 * 例:
 * "AI,業務効率,相談" -> ["ai","業務効率","相談"]
 */
function splitTags(tagsText) {
  return toSafeString(tagsText)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * ヘッダ行を index map 化
 */
function buildHeaderMap(headerRow = []) {
  return headerRow.reduce((acc, cell, index) => {
    const key = toSafeString(cell);
    if (key) {
      acc[key] = index;
    }
    return acc;
  }, {});
}

/**
 * row からヘッダ名で値取得
 */
function getCell(row = [], headerMap = {}, key = "") {
  const index = headerMap[key];
  if (index === undefined) {
    return "";
  }
  return toSafeString(row[index]);
}

/**
 * 行配列 → object
 */
function mapRowToCompany(row = [], headerMap = {}) {
  const tagsText = getCell(row, headerMap, "tags");

  return {
    company_id: getCell(row, headerMap, "company_id"),
    name: getCell(row, headerMap, "name"),
    short_name: getCell(row, headerMap, "short_name"),
    category: getCell(row, headerMap, "category"),
    tags: splitTags(tagsText),
    short_pitch: getCell(row, headerMap, "short_pitch"),
    site_url: getCell(row, headerMap, "site_url"),
    line_url: getCell(row, headerMap, "line_url"),
    map_url: getCell(row, headerMap, "map_url"),
    show_in_ai: toSafeBoolean(getCell(row, headerMap, "show_in_ai")),
    show_in_html: toSafeBoolean(getCell(row, headerMap, "show_in_html")),
    sort_order: toSafeNumber(getCell(row, headerMap, "sort_order"), 9999),
    priority: toSafeNumber(getCell(row, headerMap, "priority"), 0),
  };
}

/**
 * company_master 全件取得
 */
async function getAllCompaniesFromSheet() {
  if (!SPREADSHEET_ID) {
    throw new Error("SPREADSHEET_ID is not set.");
  }

  const sheets = createSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:Z`,
  });

  const rows = Array.isArray(res.data.values) ? res.data.values : [];

  if (rows.length <= 1) {
    return [];
  }

  const headerRow = rows[0];
  const dataRows = rows.slice(1);
  const headerMap = buildHeaderMap(headerRow);

  return dataRows
    .map((row) => mapRowToCompany(row, headerMap))
    .filter((company) => company.company_id);
}

/**
 * メッセージ正規化
 * - 最小限
 * - 英数字は小文字化
 * - 前後空白除去
 */
function normalizeUserMessage(text) {
  return toSafeString(text).toLowerCase();
}

/**
 * company 1件に対する score 算出
 *
 * ルール:
 * - tags 完全部分一致で加点
 * - category 一致で軽く加点
 * - short_name / name 一致でも加点
 */
function calculateCompanyScore(userMessage, company) {
  const normalizedMessage = normalizeUserMessage(userMessage);

  if (!normalizedMessage) {
    return 0;
  }

  let score = 0;

  const tags = Array.isArray(company.tags) ? company.tags : [];
  for (const tag of tags) {
    const normalizedTag = normalizeUserMessage(tag);
    if (!normalizedTag) {
      continue;
    }

    if (normalizedMessage.includes(normalizedTag)) {
      score += 1;
    }
  }

  const category = normalizeUserMessage(company.category);
  if (category && normalizedMessage.includes(category)) {
    score += 1;
  }

  const shortName = normalizeUserMessage(company.short_name);
  if (shortName && normalizedMessage.includes(shortName)) {
    score += 2;
  }

  const name = normalizeUserMessage(company.name);
  if (name && normalizedMessage.includes(name)) {
    score += 2;
  }

  return score;
}

/**
 * 候補整形
 */
function buildCompanyCandidate(company, score) {
  return {
    companyId: company.company_id,
    companyName: company.name,
    shortName: company.short_name,
    category: company.category,
    score,
    priority: toSafeNumber(company.priority, 0),
    sortOrder: toSafeNumber(company.sort_order, 9999),
    tags: Array.isArray(company.tags) ? company.tags : [],
    shortPitch: company.short_pitch || "",
    siteUrl: company.site_url || "",
    lineUrl: company.line_url || "",
    mapUrl: company.map_url || "",
  };
}

/**
 * 候補ソート
 *
 * 優先順:
 * 1. score DESC
 * 2. priority DESC
 * 3. sortOrder ASC
 */
function sortCompanyCandidates(candidates = []) {
  return [...candidates].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }

    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }

    return 0;
  });
}

/**
 * score 閾値で候補絞り込み
 *
 * V3.53:
 * - score < 1 は除外
 */
function filterCompanyCandidatesByScore(candidates = []) {
  return candidates.filter((item) => Number(item.score || 0) >= 1);
}

/**
 * AI表示対象のみ抽出
 */
function filterAiVisibleCompanies(companies = []) {
  return companies.filter((company) => company.show_in_ai === true);
}

/**
 * userMessage から companyCandidates を生成
 */
async function findCompanyCandidates(userMessage) {
  const companies = await getAllCompaniesFromSheet();
  const aiVisibleCompanies = filterAiVisibleCompanies(companies);

  const candidates = aiVisibleCompanies.map((company) => {
    const score = calculateCompanyScore(userMessage, company);
    return buildCompanyCandidate(company, score);
  });

  return sortCompanyCandidates(filterCompanyCandidatesByScore(candidates));
}

/**
 * company_id で1件取得
 */
async function getCompanyById(companyId) {
  const safeCompanyId = toSafeString(companyId);
  if (!safeCompanyId) {
    return null;
  }

  const companies = await getAllCompaniesFromSheet();
  return (
    companies.find((company) => company.company_id === safeCompanyId) || null
  );
}

module.exports = {
  getAllCompaniesFromSheet,
  findCompanyCandidates,
  getCompanyById,
};