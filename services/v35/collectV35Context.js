"use strict";

/**
 * services/v35/collectV35Context.js
 *
 * 役割:
 * - userMessage から company_wiki / question_stock / companyCandidates の候補を抽出する
 * - AI に渡す最小コンテキストを構築する
 *
 * 方針:
 * - 全件渡さない（最大件数で絞る）
 * - 最初は軽い一致で候補を拾う
 * - 厳密正解ではなく「候補を落としすぎない」ことを優先
 */

const { google } = require("googleapis");
const { normalizeText } = require("../../utils/textMatch");
const { getAllCompanyWikiItems } = require("../companyWikiService");
const { getAllQuestionStockRows } = require("../questionStockService");

/**
 * 候補上限
 */
const MAX_WIKI_CANDIDATES = 5;
const MAX_STOCK_CANDIDATES = 5;
const MAX_COMPANY_CANDIDATES = 3;

/**
 * V3.51:
 * company_wiki が薄い段階でも AI がテーマ類推しやすいように
 * コード側で軽く company 候補を絞って渡す
 */
const COMPANY_HINTS = [
  {
    company_id: "kanai_suits",
    topic_label: "スーツ金井",
    company_name: "オーダースーツ金井",
    keywords: ["スーツ", "オーダー", "仕立て", "ジャケット", "金井"],
  },
  {
    company_id: "ikeda_law",
    topic_label: "法律池田",
    company_name: "池田法律",
    keywords: ["法律", "弁護士", "相談", "契約", "相続", "池田"],
  },
  {
    company_id: "ozawa_wine",
    topic_label: "ワイン小澤",
    company_name: "ワイン小澤",
    keywords: ["ワイン", "赤ワイン", "白ワイン", "酒", "ペアリング", "小澤"],
  },
];

/**
 * 安全に文字列化
 */
function toSafeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

/**
 * Google Sheets client を作成
 *
 * 対応:
 * - 本番: GOOGLE_SERVICE_ACCOUNT_JSON
 * - ローカル: GOOGLE_SERVICE_ACCOUNT_FILE
 */
function createSheetsClient() {
  const fs = require("fs");
  const path = require("path");

  const rawJson = toSafeString(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const filePath = toSafeString(process.env.GOOGLE_SERVICE_ACCOUNT_FILE);

  let credentials = null;

  if (rawJson) {
    credentials = JSON.parse(rawJson);
  } else if (filePath) {
    const resolvedPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(
        `collectV35Context.createSheetsClient: service account file not found: ${resolvedPath}`
      );
    }

    const fileRaw = fs.readFileSync(resolvedPath, "utf8");
    credentials = JSON.parse(fileRaw);
  } else {
    throw new Error(
      "collectV35Context.createSheetsClient: GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE is required"
    );
  }

  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({
    version: "v4",
    auth,
  });
}

/**
 * 超軽量一致
 *
 * 方針:
 * - normalize 後に includes
 * - 双方向 includes を許容
 */
function isLooseMatch(userText = "", targetText = "") {
  const safeUser = normalizeText(userText);
  const safeTarget = normalizeText(targetText);

  if (!safeUser || !safeTarget) {
    return false;
  }

  return safeUser.includes(safeTarget) || safeTarget.includes(safeUser);
}

/**
 * company_wiki 候補抽出
 */
function pickWikiCandidates(userMessage = "", wikiItems = []) {
  if (!Array.isArray(wikiItems) || wikiItems.length === 0) {
    return [];
  }

  const matched = wikiItems.filter((item) => {
    const questionPattern = toSafeString(item.question_pattern);
    const normalizedQuestion = toSafeString(item.normalized_question);
    const answerText = toSafeString(item.answer_text);

    return (
      isLooseMatch(userMessage, questionPattern) ||
      isLooseMatch(userMessage, normalizedQuestion) ||
      isLooseMatch(userMessage, answerText)
    );
  });

  return matched.slice(0, MAX_WIKI_CANDIDATES);
}

/**
 * question_stock 候補抽出
 */
function pickStockCandidates(userMessage = "", stockItems = []) {
  if (!Array.isArray(stockItems) || stockItems.length === 0) {
    return [];
  }

  const matched = stockItems.filter((item) => {
    const question = toSafeString(item.question);
    const normalizedQuestion = toSafeString(item.normalized_question);
    const userQuestion = toSafeString(item.user_question);

    return (
      isLooseMatch(userMessage, question) ||
      isLooseMatch(userMessage, normalizedQuestion) ||
      isLooseMatch(userMessage, userQuestion)
    );
  });

  return matched.slice(0, MAX_STOCK_CANDIDATES);
}

/**
 * companyCandidates 候補抽出
 *
 * 方針:
 * - userMessage と keyword の軽い一致
 * - 1件も当たらない場合は空配列
 * - AI へノイズを渡しすぎないため最大3件
 */
function pickCompanyCandidates(userMessage = "", companyHints = []) {
  if (!Array.isArray(companyHints) || companyHints.length === 0) {
    return [];
  }

  const safeUserMessage = toSafeString(userMessage);

  const matched = companyHints
    .map((company) => {
      const keywords = Array.isArray(company.keywords) ? company.keywords : [];

      const score = keywords.reduce((total, keyword) => {
        if (isLooseMatch(safeUserMessage, keyword)) {
          return total + 1;
        }
        return total;
      }, 0);

      return {
        ...company,
        _score: score,
      };
    })
    .filter((company) => company._score > 0)
    .sort((a, b) => b._score - a._score);

  return matched.slice(0, MAX_COMPANY_CANDIDATES);
}

/**
 * AI に渡すために company_wiki 候補を軽量化
 */
function slimWikiCandidates(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
    company_id: toSafeString(item.company_id),
    company_name: toSafeString(item.company_name),
    question_pattern: toSafeString(item.question_pattern),
    normalized_question: toSafeString(item.normalized_question),
    answer_text: toSafeString(item.answer_text),
    status: toSafeString(item.status),
  }));
}

/**
 * AI に渡すために question_stock 候補を軽量化
 */
function slimStockCandidates(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
    company_id: toSafeString(item.company_id),
    question: toSafeString(item.question),
    normalized_question: toSafeString(item.normalized_question),
    user_question: toSafeString(item.user_question),
    asked_count: Number(item.asked_count || 0),
    stock_status: toSafeString(item.stock_status),
    draft_answer: toSafeString(item.draft_answer),
  }));
}

/**
 * AI に渡すために companyCandidates を軽量化
 */
function slimCompanyCandidates(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
    company_id: toSafeString(item.company_id),
    topic_label: toSafeString(item.topic_label),
    company_name: toSafeString(item.company_name),
    keywords: Array.isArray(item.keywords)
      ? item.keywords.map((keyword) => toSafeString(keyword)).filter(Boolean)
      : [],
  }));
}

/**
 * メイン
 */
async function collectV35Context(input = {}) {
  const rid = toSafeString(input.rid) || "no_rid";
  const userMessage = toSafeString(input.userMessage);

  try {
    if (!userMessage) {
      return {
        success: false,
        message: "collectV35Context: userMessage is required",
        data: {
          rid,
        },
      };
    }

    /**
     * 1. company_wiki 全件取得
     */
    const allWikiItems = await getAllCompanyWikiItems();

    /**
     * 2. question_stock 全件取得
     */
    const sheets = createSheetsClient();
    const allStockItems = await getAllQuestionStockRows(sheets);

    /**
     * 3. 候補抽出
     */
    const wikiCandidates = pickWikiCandidates(userMessage, allWikiItems);
    const stockCandidates = pickStockCandidates(userMessage, allStockItems);
    const companyCandidatesRaw = pickCompanyCandidates(userMessage, COMPANY_HINTS);

    /**
     * 4. AI 用に軽量化
     */
    const companyWikiCandidates = slimWikiCandidates(wikiCandidates);
    const questionStockCandidates = slimStockCandidates(stockCandidates);
    const companyCandidates = slimCompanyCandidates(companyCandidatesRaw);

    return {
      success: true,
      message: "collectV35Context success",
      data: {
        companyWikiCandidates,
        questionStockCandidates,
        companyCandidates,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error?.message || "collectV35Context failed",
      data: {
        rid,
      },
    };
  }
}

module.exports = {
  MAX_WIKI_CANDIDATES,
  MAX_STOCK_CANDIDATES,
  MAX_COMPANY_CANDIDATES,
  COMPANY_HINTS,
  toSafeString,
  createSheetsClient,
  isLooseMatch,
  pickWikiCandidates,
  pickStockCandidates,
  pickCompanyCandidates,
  slimWikiCandidates,
  slimStockCandidates,
  slimCompanyCandidates,
  collectV35Context,
};