"use strict";

/**
 * services/v35/applyV35Actions.js
 *
 * V3.53 変更点:
 * - matchedCompanyId を最終ゲートとして使用
 * - 空の場合は必ず「テーマ無し扱い」に補正
 */

const { saveQuestionStock } = require("../questionStockService");
const { normalizeText } = require("../../utils/textMatch");

const NO_TOPIC_LABEL = "テーマ無し";
const NO_TOPIC_SUFFIX = "【テーマ無し】⇒協賛企業から選択";

/**
 * 安全に文字列化
 */
function toSafeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * 🔥 V3.53コア
 * topicLabel と matchedCompanyId の整合性を保証
 *
 * ルール:
 * - matchedCompanyId が空なら必ず テーマ無し
 */
function normalizeCompanyOutput(parsed = {}) {
  const matchedCompanyId = toSafeString(parsed.matchedCompanyId);

  if (!matchedCompanyId) {
    return {
      ...parsed,
      topicLabel: NO_TOPIC_LABEL,
      matchedCompanyId: "",
    };
  }

  return parsed;
}

/**
 * 文末テーマ表示
 */
function buildTopicSuffix(parsed = {}) {
  const topicLabel = toSafeString(parsed.topicLabel) || NO_TOPIC_LABEL;

  if (topicLabel === NO_TOPIC_LABEL) {
    return NO_TOPIC_SUFFIX;
  }

  return `【${topicLabel}】`;
}

/**
 * 最終返信文
 */
function buildFinalReply(parsed = {}) {
  const replyMessage = toSafeString(parsed.replyMessage);
  const topicSuffix = buildTopicSuffix(parsed);

  if (!replyMessage) {
    return topicSuffix;
  }

  return `${replyMessage}\n${topicSuffix}`;
}

/**
 * question_stock payload
 */
function buildQuestionStockPayload(input = {}) {
  const parsed = input.parsed || {};
  const stockDraft = parsed.stockDraft || {};

  const userMessage = toSafeString(input.userMessage);
  const normalizedUserMessage = normalizeText(userMessage);

  return {
    user_id: toSafeString(input.userId),
    bot_id: toSafeString(input.bot_id),
    question: toSafeString(stockDraft.question) || userMessage,
    normalized_question:
      toSafeString(stockDraft.normalized_question) || normalizedUserMessage,
    company_id:
      toSafeString(stockDraft.company_id) ||
      toSafeString(parsed.matchedCompanyId),
    user_question: toSafeString(stockDraft.user_question) || userMessage,
    wiki_answer: "",
    review_note: "",
    question_category: toSafeString(stockDraft.question_category) || "",
    group_key: "",
    canonical_question: "",
    draft_answer: toSafeString(stockDraft.draft_answer) || "",
    draft_answer_source:
      toSafeString(stockDraft.draft_answer_source) || "v35_ai",
    adopted_at: "",
  };
}

/**
 * stock保存
 */
async function saveStockIfNeeded(input = {}) {
  const parsed = input.parsed || {};
  const stockAction = toSafeString(parsed.stockAction);

  if (stockAction !== "append") {
    return { success: true, message: "stock save skipped", data: {} };
  }

  const payload = buildQuestionStockPayload(input);

  if (!payload.question || !payload.normalized_question) {
    return {
      success: false,
      message: "question_stock payload invalid",
      data: { payload },
    };
  }

  const saveResult = await saveQuestionStock(payload);

  if (!saveResult?.success) {
    return {
      success: false,
      message: saveResult?.message || "saveQuestionStock failed",
      data: { payload },
    };
  }

  return {
    success: true,
    message: "stock saved",
    data: saveResult.data || null,
  };
}

/**
 * メイン
 */
async function applyV35Actions(input = {}) {
  const rid = toSafeString(input.rid) || "no_rid";
  let parsed = input.parsed || null;

  try {
    if (!parsed || typeof parsed !== "object") {
      return {
        success: false,
        message: "parsed is required",
        data: { rid },
      };
    }

    /**
     * 🔥 V3.53コア適用
     */
    parsed = normalizeCompanyOutput(parsed);

    const finalReply = buildFinalReply(parsed);

    const stockResult = await saveStockIfNeeded({
      ...input,
      parsed,
    });

    if (!stockResult.success) {
      return {
        success: false,
        message: stockResult.message,
        data: {
          rid,
          parsed,
          finalReply,
        },
      };
    }

    return {
      success: true,
      message: "applyV35Actions success",
      data: {
        rid,
        replyText: finalReply,
        topicLabel: toSafeString(parsed.topicLabel),
        matchedCompanyId: toSafeString(parsed.matchedCompanyId),
        usedWiki: parsed.usedWiki === true,
        judgement: toSafeString(parsed.judgement),
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error?.message || "applyV35Actions failed",
      data: { rid },
    };
  }
}

module.exports = {
  applyV35Actions,
};