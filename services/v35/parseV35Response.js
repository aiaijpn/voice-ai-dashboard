"use strict";

/**
 * services/v35/parseV35Response.js
 *
 * V3.53 変更点:
 * - matchedCompanyId を許可リストで検証
 * - 不正IDは強制的に空にする
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
 * 安全文字列
 */
function toSafeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * boolean
 */
function toSafeBoolean(value) {
  return value === true;
}

/**
 * wikiAction
 */
function normalizeWikiAction(value) {
  return toSafeString(value) === "draft" ? "draft" : "none";
}

/**
 * stockAction
 */
function normalizeStockAction(value) {
  return toSafeString(value) === "append" ? "append" : "none";
}

/**
 * judgement
 */
function normalizeJudgement(value) {
  const allowed = [
    "wiki_answer",
    "stock_append",
    "general_reply",
    "no_topic",
  ];
  const safe = toSafeString(value);
  return allowed.includes(safe) ? safe : "general_reply";
}

/**
 * wikiDraft
 */
function normalizeWikiDraft(value) {
  if (!value || typeof value !== "object") return null;

  return {
    company_id: toSafeString(value.company_id),
    question_pattern: toSafeString(value.question_pattern),
    normalized_question: toSafeString(value.normalized_question),
    answer_text: toSafeString(value.answer_text),
    draft_reason: toSafeString(value.draft_reason),
  };
}

/**
 * stockDraft
 */
function normalizeStockDraft(value) {
  if (!value || typeof value !== "object") return null;

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
 * 許可IDセット生成（V3.53コア）
 */
function buildAllowedCompanyIdSet(context = {}) {
  const set = new Set();

  const candidates = Array.isArray(context.companyCandidates)
    ? context.companyCandidates
    : [];

  for (const c of candidates) {
    const id = toSafeString(c.company_id || c.companyId);
    if (id) set.add(id);
  }

  const currentId = toSafeString(context.currentCompanyId);
  if (currentId) set.add(currentId);

  return set;
}

/**
 * parsed object 正規化
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
 * JSON抽出
 */
function extractJsonText(text = "") {
  const safeText = String(text || "").trim();

  const start = safeText.indexOf("{");
  const end = safeText.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) return "";

  return safeText.slice(start, end + 1);
}

/**
 * メイン（V3.53）
 */
function parseV35Response(input = {}) {
  const rid = String(input.rid || "no_rid");
  const aiRawText = String(input.aiRawText || "").trim();
  const context = input.context || {}; // ←追加

  try {
    if (!aiRawText) {
      return {
        success: false,
        message: "aiRawText is empty",
        data: { rid, parsed: { ...DEFAULT_PARSED } },
      };
    }

    const jsonText = extractJsonText(aiRawText);

    if (!jsonText) {
      return {
        success: false,
        message: "JSON block not found",
        data: { rid, parsed: { ...DEFAULT_PARSED }, aiRawText },
      };
    }

    const rawObject = JSON.parse(jsonText);
    const parsed = normalizeParsedObject(rawObject);

    /**
     * 🔥 V3.53 コア
     * 不正 company_id を排除
     */
    const allowedIds = buildAllowedCompanyIdSet(context);

    if (!allowedIds.has(parsed.matchedCompanyId)) {
      parsed.matchedCompanyId = "";
    }

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
  parseV35Response,
};