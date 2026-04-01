"use strict";

/**
 * services/v35/collectV35Context.js
 *
 * 役割:
 * - userMessage から company_wiki / question_stock の候補を抽出する
 * - AI に渡す最小コンテキストを構築する
 *
 * 方針:
 * - 全件渡さない（最大件数で絞る）
 * - 最初は軽い一致で候補を拾う
 * - company_name / company_id / 質問文 / 回答文 も候補抽出に使う
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

/**
 * 協賛テーマの補助キーワード
 *
 * 目的:
 * - company_wiki 候補が薄くても
 *   userMessage からテーマを拾いやすくする
 */
const COMPANY_HINTS = [
  {
    company_id: "kanai_suits",
    company_name: "オーダースーツ金井",
    topic_label: "スーツ金井",
    keywords: [
      "スーツ",
      "オーダースーツ",
      "オーダー",
      "仕立て",
      "ジャケット",
      "パンツ",
      "ネクタイ",
      "礼服",
      "採寸",
      "金井",
    ],
  },
  {
    company_id: "ikeda_law",
    company_name: "池田法律",
    topic_label: "法律池田",
    keywords: [
      "法律",
      "弁護士",
      "法務",
      "相談",
      "契約",
      "離婚",
      "相続",
      "トラブル",
      "裁判",
      "池田",
    ],
  },
  {
    company_id: "ozawa_wine",
    company_name: "ワイン小澤",
    topic_label: "ワイン小澤",
    keywords: [
      "ワイン",
      "赤ワイン",
      "白ワイン",
      "ロゼ",
      "ぶどう",
      "酒",
      "ペアリング",
      "小澤",
    ],
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
 * userMessage がキーワード群のどれかに一致するか
 */
function matchesAnyKeyword(userMessage = "", keywords = []) {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return false;
  }

  return keywords.some((keyword) => isLooseMatch(userMessage, keyword));
}

/**
 * userMessage から company hint を抽出
 */
function detectCompanyHints(userMessage = "") {
  return COMPANY_HINTS.filter((item) =>
    matchesAnyKeyword(userMessage, item.keywords)
  );
}

/**
 * hint から擬似 wiki 候補を作る
 *
 * 目的:
 * - 実wiki候補が薄いときでも
 *   AIに company テーマ候補を渡せるようにする
 */
function buildHintBasedWikiCandidates(hints = []) {
  if (!Array.isArray(hints) || hints.length === 0) {
    return [];
  }

  return hints.map((hint) => ({
    company_id: toSafeString(hint.company_id),
    company_name: toSafeString(hint.company_name),
    question_pattern: "",
    normalized_question: "",
    answer_text: "",
    status: "hint",
  }));
}

/**
 * company_wiki 候補抽出
 */
function pickWikiCandidates(userMessage = "", wikiItems = []) {
  if (!Array.isArray(wikiItems) || wikiItems.length === 0) {
    return [];
  }

  const matched = wikiItems.filter((item) => {
    const companyId = toSafeString(item.company_id);
    const companyName = toSafeString(item.company_name);
    const questionPattern = toSafeString(item.question_pattern);
    const normalizedQuestion = toSafeString(item.normalized_question);
    const answerText = toSafeString(item.answer_text);

    return (
      isLooseMatch(userMessage, companyId) ||
      isLooseMatch(userMessage, companyName) ||
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
    const companyId = toSafeString(item.company_id);
    const question = toSafeString(item.question);
    const normalizedQuestion = toSafeString(item.normalized_question);
    const userQuestion = toSafeString(item.user_question);
    const draftAnswer = toSafeString(item.draft_answer);

    return (
      isLooseMatch(userMessage, companyId) ||
      isLooseMatch(userMessage, question) ||
      isLooseMatch(userMessage, normalizedQuestion) ||
      isLooseMatch(userMessage, userQuestion) ||
      isLooseMatch(userMessage, draftAnswer)
    );
  });

  return matched.slice(0, MAX_STOCK_CANDIDATES);
}

/**
 * 重複除去
 *
 * 優先キー:
 * - company_id
 * - normalized_question
 * - question_pattern
 */
function dedupeWikiCandidates(items = []) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = [
      toSafeString(item.company_id),
      toSafeString(item.normalized_question),
      toSafeString(item.question_pattern),
    ].join("::");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result.slice(0, MAX_WIKI_CANDIDATES);
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
     * 3. 既存データから候補抽出
     */
    const matchedWikiCandidates = pickWikiCandidates(userMessage, allWikiItems);
    const stockCandidates = pickStockCandidates(userMessage, allStockItems);

    /**
     * 4. 補助キーワードから擬似候補追加
     */
    const hintMatches = detectCompanyHints(userMessage);
    const hintBasedWikiCandidates = buildHintBasedWikiCandidates(hintMatches);

    /**
     * 5. wiki候補を統合
     */
    const mergedWikiCandidates = dedupeWikiCandidates([
      ...matchedWikiCandidates,
      ...hintBasedWikiCandidates,
    ]);

    /**
     * 6. AI 用に軽量化
     */
    const companyWikiCandidates = slimWikiCandidates(mergedWikiCandidates);
    const questionStockCandidates = slimStockCandidates(stockCandidates);

    return {
      success: true,
      message: "collectV35Context success",
      data: {
        companyWikiCandidates,
        questionStockCandidates,
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
  COMPANY_HINTS,
  toSafeString,
  createSheetsClient,
  isLooseMatch,
  matchesAnyKeyword,
  detectCompanyHints,
  buildHintBasedWikiCandidates,
  pickWikiCandidates,
  pickStockCandidates,
  dedupeWikiCandidates,
  slimWikiCandidates,
  slimStockCandidates,
  collectV35Context,
};