"use strict";

/**
 * services/v35/parseV35Response.js
 *
 * 役割:
 * - AI返却テキストを JSON として解析する
 * - 必須項目を安全に補完する
 * - 壊れたJSONでも極力落ちずに返す
 *
 * このファイルでやること:
 * - JSON.parse
 * - 必須フィールド補完
 * - null / 空文字の安全化
 *
 * このファイルでやらないこと:
 * - OpenAI API 呼び出し
 * - question_stock 保存
 * - company_wiki 保存
 * - 最終返信文の装飾
 */

const DEFAULT_PARSED = {
  topicLabel: "テーマ無し",
  replyMessage: "",
  matchedCompanyId: "",
  usedWiki: false,
  wikiAction: "none",
  wikiDraft: null,
  stockAction: "none",
  stockDraft: null,
  judgement: "general_reply",
};

/**
 * 文字列化
 */
function toSafeString(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

/**
 * boolean化
 */
function toSafeBoolean(value) {
  return value === true;
}

/**
 * wikiAction 正規化
 */
function normalizeWikiAction(value) {
  const safe = toSafeString(value);

  if (safe === "draft") {
    return "draft";
  }

  return "none";
}

/**
 * stockAction 正規化
 */
function normalizeStockAction(value) {
  const safe = toSafeString(value);

  if (safe === "append") {
    return "append";
  }

  return "none";
}

/**
 * judgement 正規化
 */
function normalizeJudgement(value) {
  const safe = toSafeString(value);

  const allowed = [
    "wiki_answer",
    "stock_append",
    "general_reply",
    "no_topic",
  ];

  if (allowed.includes(safe)) {
    return safe;
  }

  return "general_reply";
}

/**
 * wikiDraft 正規化
 */
function normalizeWikiDraft(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return {
    company_id: toSafeString(value.company_id),
    question_pattern: toSafeString(value.question_pattern),
    normalized_question: toSafeString(value.normalized_question),
    answer_text: toSafeString(value.answer_text),
    draft_reason: toSafeString(value.draft_reason),
  };
}

/**
 * stockDraft 正規化
 */
function normalizeStockDraft(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return {
    company_id: toSafeString(value.company_id),
    question: toSafeString(value.question),
    normalized_question: toSafeString(value.normalized_question),
    user_question: toSafeString(value.user_question),
    question_category: toSafeString(value.question_category),
    draft_answer: toSafeString(value.draft_answer),
    draft_answer_source: toSafeString(value.draft_answer_source),
  };
}

/**
 * AI返却オブジェクトを安全化
 */
function normalizeParsedObject(raw = {}) {
  return {
    topicLabel: toSafeString(raw.topicLabel) || DEFAULT_PARSED.topicLabel,
    replyMessage: toSafeString(raw.replyMessage),
    matchedCompanyId:
      toSafeString(raw.matchedCompanyId) || DEFAULT_PARSED.matchedCompanyId,
    usedWiki: toSafeBoolean(raw.usedWiki),
    wikiAction: normalizeWikiAction(raw.wikiAction),
    wikiDraft: normalizeWikiDraft(raw.wikiDraft),
    stockAction: normalizeStockAction(raw.stockAction),
    stockDraft: normalizeStockDraft(raw.stockDraft),
    judgement: normalizeJudgement(raw.judgement),
  };
}

/**
 * JSON文字列の前後に余計な文字が混じる場合に備え、
 * 最初の "{" から最後の "}" までを切り出す
 */
function extractJsonText(text = "") {
  const safeText = String(text || "").trim();

  const start = safeText.indexOf("{");
  const end = safeText.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    return "";
  }

  return safeText.slice(start, end + 1);
}

/**
 * メイン
 */
function parseV35Response(input = {}) {
  const rid = String(input.rid || "no_rid");
  const aiRawText = String(input.aiRawText || "").trim();

  try {
    if (!aiRawText) {
      return {
        success: false,
        message: "aiRawText is empty",
        data: {
          rid,
          parsed: { ...DEFAULT_PARSED },
        },
      };
    }

    const jsonText = extractJsonText(aiRawText);

    if (!jsonText) {
      return {
        success: false,
        message: "JSON block not found",
        data: {
          rid,
          parsed: { ...DEFAULT_PARSED },
          aiRawText,
        },
      };
    }

    const rawObject = JSON.parse(jsonText);
    const parsed = normalizeParsedObject(rawObject);

    return {
      success: true,
      message: "parseV35Response success",
      data: {
        rid,
        parsed,
        aiRawText,
        jsonText,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error?.message || "parseV35Response failed",
      data: {
        rid,
        parsed: { ...DEFAULT_PARSED },
        aiRawText,
      },
    };
  }
}

module.exports = {
  DEFAULT_PARSED,
  toSafeString,
  toSafeBoolean,
  normalizeWikiAction,
  normalizeStockAction,
  normalizeJudgement,
  normalizeWikiDraft,
  normalizeStockDraft,
  normalizeParsedObject,
  extractJsonText,
  parseV35Response,
};