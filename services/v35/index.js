"use strict";

/**
 * services/v35/applyV35Actions.js
 *
 * 役割:
 * - AI解析結果をもとに最終返信文を作る
 * - 必要時のみ question_stock へ保存する
 * - 今回は company_wiki へは保存しない（draftのみ保持）
 *
 * このファイルでやること:
 * - 回答本文を優先した最終返信生成
 * - 文末に topicLabel を付与
 * - テーマ無し時は文末に固定案内を付与
 * - stockAction === "append" のときだけ question_stock 保存
 *
 * このファイルでやらないこと:
 * - OpenAI API 呼び出し
 * - AI返却JSON解析
 * - company_wiki 本保存
 */

const { saveQuestionStock } = require("../questionStockService");
const { normalizeText } = require("../../utils/textMatch");

const NO_TOPIC_LABEL = "テーマ無し";
const NO_TOPIC_SUFFIX = "【テーマ無し】⇒協賛企業から選択";

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
 * 文末に付けるテーマ表示を作る
 *
 * 仕様:
 * - テーマ無し -> 【テーマ無し】⇒協賛企業から選択
 * - それ以外   -> 【topicLabel】
 */
function buildTopicSuffix(parsed = {}) {
  const topicLabel = toSafeString(parsed.topicLabel) || NO_TOPIC_LABEL;

  if (topicLabel === NO_TOPIC_LABEL) {
    return NO_TOPIC_SUFFIX;
  }

  return `【${topicLabel}】`;
}

/**
 * 最終返信文を作る
 *
 * 仕様:
 * - 回答本文を先に出す
 * - 最後にテーマ表示を付ける
 * - replyMessage が空でも、テーマ表示だけは返す
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
 * question_stock 保存payloadを作る
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
 * question_stock 保存
 */
async function saveStockIfNeeded(input = {}) {
  const parsed = input.parsed || {};
  const stockAction = toSafeString(parsed.stockAction);

  if (stockAction !== "append") {
    return {
      success: true,
      message: "stock save skipped",
      data: {
        action: "none",
      },
    };
  }

  const payload = buildQuestionStockPayload(input);

  if (!payload.question || !payload.normalized_question) {
    return {
      success: false,
      message: "question_stock payload invalid",
      data: {
        payload,
      },
    };
  }

  const saveResult = await saveQuestionStock(payload);

  if (!saveResult?.success) {
    return {
      success: false,
      message: saveResult?.message || "saveQuestionStock failed",
      data: {
        payload,
        saveResult: saveResult?.data || null,
      },
    };
  }

  return {
    success: true,
    message: "stock saved",
    data: {
      action: "append",
      payload,
      saveResult: saveResult.data || null,
    },
  };
}

/**
 * メイン
 */
async function applyV35Actions(input = {}) {
  const rid = toSafeString(input.rid) || "no_rid";
  const parsed = input.parsed || null;

  try {
    if (!parsed || typeof parsed !== "object") {
      return {
        success: false,
        message: "parsed is required",
        data: {
          rid,
        },
      };
    }

    const finalReply = buildFinalReply(parsed);

    const stockResult = await saveStockIfNeeded({
      ...input,
      parsed,
    });

    if (!stockResult.success) {
      return {
        success: false,
        message: stockResult.message || "saveStockIfNeeded failed",
        data: {
          rid,
          parsed,
          finalReply,
          stockResult: stockResult.data || null,
        },
      };
    }

    return {
      success: true,
      message: "applyV35Actions success",
      data: {
        rid,
        replyText: finalReply,
        topicLabel: toSafeString(parsed.topicLabel) || NO_TOPIC_LABEL,
        matchedCompanyId: toSafeString(parsed.matchedCompanyId),
        usedWiki: parsed.usedWiki === true,
        wikiAction: toSafeString(parsed.wikiAction) || "none",
        wikiDraft: parsed.wikiDraft || null,
        stockAction: toSafeString(parsed.stockAction) || "none",
        stockDraft: parsed.stockDraft || null,
        judgement: toSafeString(parsed.judgement) || "general_reply",
        stockSaveResult: stockResult.data || null,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error?.message || "applyV35Actions failed",
      data: {
        rid,
      },
    };
  }
}

module.exports = {
  NO_TOPIC_LABEL,
  NO_TOPIC_SUFFIX,
  toSafeString,
  buildTopicSuffix,
  buildFinalReply,
  buildQuestionStockPayload,
  saveStockIfNeeded,
  applyV35Actions,
};