"use strict";

/**
 * services/v35/parseV35Response.js
 *
 * V3.53:
 * - matchedCompanyId を許可リストで検証
 * - 不正IDは強制的に空にする
 * - companyCandidates が1件だけで、replyMessage がその企業に明確に触れている場合は
 *   matchedCompanyId / topicLabel を補完する
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

function toSafeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toSafeBoolean(value) {
  return value === true;
}

function normalizeWikiAction(value) {
  return toSafeString(value) === "draft" ? "draft" : "none";
}

function normalizeStockAction(value) {
  return toSafeString(value) === "append" ? "append" : "none";
}

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

function extractJsonText(text = "") {
  const safeText = String(text || "").trim();

  const start = safeText.indexOf("{");
  const end = safeText.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) return "";

  return safeText.slice(start, end + 1);
}

function messageMentionsCandidate(replyMessage = "", candidate = {}) {
  const safeReply = toSafeString(replyMessage);
  if (!safeReply) return false;

  const words = [
    toSafeString(candidate.topic_label),
    toSafeString(candidate.company_name),
    ...(Array.isArray(candidate.keywords) ? candidate.keywords : []),
  ]
    .map((x) => toSafeString(x))
    .filter((x) => x && x.length >= 2);

  return words.some((word) => safeReply.includes(word));
}

function fillCompanyFromSingleCandidate(parsed = {}, context = {}) {
  const safeMatchedCompanyId = toSafeString(parsed.matchedCompanyId);
  if (safeMatchedCompanyId) {
    return parsed;
  }

  const candidates = Array.isArray(context.companyCandidates)
    ? context.companyCandidates
    : [];

  if (candidates.length !== 1) {
    return parsed;
  }

  const candidate = candidates[0] || {};

  if (!messageMentionsCandidate(parsed.replyMessage, candidate)) {
    return parsed;
  }

  return {
    ...parsed,
    matchedCompanyId: toSafeString(candidate.company_id || candidate.companyId),
    topicLabel:
      toSafeString(candidate.topic_label || candidate.topicLabel) ||
      parsed.topicLabel,
  };
}

function parseV35Response(input = {}) {
  const rid = String(input.rid || "no_rid");
  const aiRawText = String(input.aiRawText || "").trim();
  const context = input.context || {};

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
    let parsed = normalizeParsedObject(rawObject);

    const beforeMatchedCompanyId = parsed.matchedCompanyId;
    const beforeTopicLabel = parsed.topicLabel;

    parsed = fillCompanyFromSingleCandidate(parsed, context);

    const allowedIds = buildAllowedCompanyIdSet(context);

    if (!allowedIds.has(parsed.matchedCompanyId)) {
      parsed.matchedCompanyId = "";
    }

    if (
      !parsed.matchedCompanyId &&
      parsed.topicLabel !== DEFAULT_PARSED.topicLabel
    ) {
      parsed.topicLabel = DEFAULT_PARSED.topicLabel;
    }

    // 最小ログ
    console.log("### PARSE V3.53 ###", {
      rid,
      beforeMatchedCompanyId,
      beforeTopicLabel,
      finalMatchedCompanyId: parsed.matchedCompanyId,
      finalTopicLabel: parsed.topicLabel,
      allowedIdCount: allowedIds.size,
    });

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
    console.log("### PARSE V3.53 ERROR ###", {
      rid,
      error: error?.message || error,
    });

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