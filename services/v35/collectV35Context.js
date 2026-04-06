"use strict";

/**
 * services/v35/collectV35Context.js
 *
 * 役割:
 * - userMessage から company_wiki / question_stock / companyCandidates の候補を抽出する
 * - 会話履歴から currentCompany を補助取得する
 * - AI に渡す最小コンテキストを構築する
 *
 * 方針:
 * - 全件渡さない（最大件数で絞る）
 * - 最初は軽い一致で候補を拾う
 * - 厳密正解ではなく「候補を落としすぎない」ことを優先
 * - V3.52では companyCandidates を company_master シート由来に切り替える
 * - V3.53では currentCompanyId / isConversationContinuing を追加する
 */

const { google } = require("googleapis");
const { normalizeText } = require("../../utils/textMatch");
const { getAllCompanyWikiItems } = require("../companyWikiService");
const { getAllQuestionStockRows } = require("../questionStockService");
const { findCompaniesForAi } = require("../companyService");

/**
 * 候補上限
 */
const MAX_WIKI_CANDIDATES = 5;
const MAX_STOCK_CANDIDATES = 5;
const MAX_COMPANY_CANDIDATES = 3;

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
 * 会話履歴から currentCompany を拾う
 *
 * 想定:
 * - conversationHistory の新しいものから見る
 * - matchedCompanyId があれば採用
 */
function pickCurrentCompanyFromHistory(conversationHistory = []) {
  if (!Array.isArray(conversationHistory) || conversationHistory.length === 0) {
    return {
      currentCompanyId: "",
      currentCompanyName: "",
      isConversationContinuing: false,
    };
  }

  for (let i = conversationHistory.length - 1; i >= 0; i -= 1) {
    const row = conversationHistory[i] || {};

    const matchedCompanyId = toSafeString(
      row.matchedCompanyId || row.matched_company_id || row.company_id
    );

    const matchedCompanyName = toSafeString(
      row.matchedCompanyName || row.matched_company_name || row.company_name
    );

    if (matchedCompanyId) {
      return {
        currentCompanyId: matchedCompanyId,
        currentCompanyName: matchedCompanyName,
        isConversationContinuing: true,
      };
    }
  }

  return {
    currentCompanyId: "",
    currentCompanyName: "",
    isConversationContinuing: false,
  };
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
 *
 * V3.52:
 * - company_master シート由来の row を AI入力用shapeへ変換
 */
function slimCompanyCandidates(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.slice(0, MAX_COMPANY_CANDIDATES).map((item) => ({
    company_id: toSafeString(item.company_id),
    topic_label: toSafeString(item.short_name || item.name),
    company_name: toSafeString(item.name),
    keywords: toSafeString(item.tags)
      .split(",")
      .map((keyword) => toSafeString(keyword))
      .filter(Boolean),
  }));
}

/**
 * メイン
 */
async function collectV35Context(input = {}) {
  const rid = toSafeString(input.rid) || "no_rid";
  const userMessage = toSafeString(input.userMessage);
  const conversationHistory = Array.isArray(input.conversationHistory)
    ? input.conversationHistory
    : [];

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
    const companyCandidatesRaw = await findCompaniesForAi(userMessage);

    /**
     * 4. 会話継続中の currentCompany を取得
     */
    const {
      currentCompanyId,
      currentCompanyName,
      isConversationContinuing,
    } = pickCurrentCompanyFromHistory(conversationHistory);

    /**
     * 5. AI 用に軽量化
     */
    const companyWikiCandidates = slimWikiCandidates(wikiCandidates);
    const questionStockCandidates = slimStockCandidates(stockCandidates);
    const companyCandidates = slimCompanyCandidates(companyCandidatesRaw);

    /**
     * 6. デバッグログ
     */
    console.log("### COLLECT V3.53 ###");
    console.log("rid:", rid);
    console.log("userMessage:", userMessage);
    console.log("wikiCandidates.length:", companyWikiCandidates.length);
    console.log("stockCandidates.length:", questionStockCandidates.length);
    console.log("companyCandidatesRaw:", companyCandidatesRaw);
    console.log("companyCandidates:", companyCandidates);
    console.log("companyCandidates.length:", companyCandidates.length);
    console.log("currentCompanyId:", currentCompanyId);
    console.log("currentCompanyName:", currentCompanyName);
    console.log("isConversationContinuing:", isConversationContinuing);

    return {
      success: true,
      message: "collectV35Context success",
      data: {
        companyWikiCandidates,
        questionStockCandidates,
        companyCandidates,
        currentCompanyId,
        currentCompanyName,
        isConversationContinuing,
      },
    };
  } catch (error) {
    console.log("### COLLECT V3.53 ERROR ###");
    console.log("rid:", rid);
    console.log("userMessage:", userMessage);
    console.log("error:", error?.message || error);

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
  toSafeString,
  createSheetsClient,
  isLooseMatch,
  pickWikiCandidates,
  pickStockCandidates,
  pickCurrentCompanyFromHistory,
  slimWikiCandidates,
  slimStockCandidates,
  slimCompanyCandidates,
  collectV35Context,
};