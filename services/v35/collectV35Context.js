"use strict";

/**
 * services/v35/collectV35Context.js
 *
 * 役割:
 * - userMessage から company_wiki / question_stock / companyCandidates の候補を抽出する
 * - 会話履歴から currentCompany を補助取得する
 * - AI に渡す最小コンテキストを構築する
 *
 * V3.54 修正点:
 * - companyJudgeService が使う score / strongHitCount / weakHitCount / matchedTerms を
 *   slimCompanyCandidates に残す
 * - companyCandidates の判断材料を落とさない
 */

const { google } = require("googleapis");
const { normalizeText } = require("../../utils/textMatch");
const { getAllCompanyWikiItems } = require("../companyWikiService");
const { getAllQuestionStockRows } = require("../questionStockService");
const { findCompaniesForAi } = require("../companyService");

const MAX_WIKI_CANDIDATES = 5;
const MAX_STOCK_CANDIDATES = 5;
const MAX_COMPANY_CANDIDATES = 3;

function toSafeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

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

function isLooseMatch(userText = "", targetText = "") {
  const safeUser = normalizeText(userText);
  const safeTarget = normalizeText(targetText);

  if (!safeUser || !safeTarget) {
    return false;
  }

  return safeUser.includes(safeTarget) || safeTarget.includes(safeUser);
}

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
 * V3.54:
 * - judge前段で使う scoring 情報を残す
 */
function slimCompanyCandidates(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.slice(0, MAX_COMPANY_CANDIDATES).map((item) => ({
    company_id: toSafeString(item.company_id),
    topic_label: toSafeString(item.short_name || item.name),
    company_name: toSafeString(item.name),
    keywords: toSafeArray(item.tags)
      .map((keyword) => toSafeString(keyword))
      .filter(Boolean),

    // judge用に必要な材料を残す
    score: Number(item.score || 0),
    strongHitCount: Number(item.strongHitCount || 0),
    weakHitCount: Number(item.weakHitCount || 0),
    matchedTerms: toSafeArray(item.matchedTerms)
      .map((term) => toSafeString(term))
      .filter(Boolean),

    // デバッグ補助
    priority: Number(item.priority || 0),
    sort_order: Number(item.sort_order || 9999),
  }));
}

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

    const allWikiItems = await getAllCompanyWikiItems();

    const sheets = createSheetsClient();
    const allStockItems = await getAllQuestionStockRows(sheets);
    

    const wikiCandidates = pickWikiCandidates(userMessage, allWikiItems);
    const stockCandidates = pickStockCandidates(userMessage, allStockItems);
    
    const companyCandidatesRaw = await findCompaniesForAi(userMessage);
  
    const {
      currentCompanyId,
      currentCompanyName,
      isConversationContinuing,
    } = pickCurrentCompanyFromHistory(conversationHistory);

    const companyWikiCandidates = slimWikiCandidates(wikiCandidates);
    const questionStockCandidates = slimStockCandidates(stockCandidates);
    const companyCandidates = slimCompanyCandidates(companyCandidatesRaw);

    console.log("### COLLECT V3.54 ###", {
      rid,
      userMessage,
      wikiCount: companyWikiCandidates.length,
      stockCount: questionStockCandidates.length,
      companyCount: companyCandidates.length,
      currentCompanyId,
      isConversationContinuing,
      companyTop: companyCandidates[0]
        ? {
            company_id: companyCandidates[0].company_id,
            topic_label: companyCandidates[0].topic_label,
            score: companyCandidates[0].score,
            strongHitCount: companyCandidates[0].strongHitCount,
            weakHitCount: companyCandidates[0].weakHitCount,
            matchedTerms: companyCandidates[0].matchedTerms,
          }
        : null,
    });

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
    console.log("### COLLECT V3.54 ERROR ###", {
      rid,
      userMessage,
      error: error?.message || error,
    });

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
  toSafeArray,
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