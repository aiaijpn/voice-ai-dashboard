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
 * - topicLabel 付き返信生成
 * - テーマ無し時の固定上書き
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
const NO_TOPIC_REPLY =
  "【テーマ無し】⇒協賛企業から選択\n今日はどんなことを知りたいですか？";

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
 * 最終返信文を作る
 *
 * 仕様:
 * - topicLabel が テーマ無し のときは固定文を強制返却
 * - それ以外は
 *   【topicLabel】
 *   replyMessage
 */
function buildFinalReply(parsed = {}) {
  const topicLabel = toSafeString(parsed.topicLabel) || NO_TOPIC_LABEL;
  const replyMessage = toSafeString(parsed.replyMessage);

  if (topicLabel === NO_TOPIC_LABEL) {
    return NO_TOPIC_REPLY;
  }

  return `【${topicLabel}】\n${replyMessage || "確認しました。"}`;
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
    question:
      toSafeString(stockDraft.question) || userMessage,
    normalized_question:
      toSafeString(stockDraft.normalized_question) || normalizedUserMessage,
    company_id:
      toSafeString(stockDraft.company_id) ||
      toSafeString(parsed.matchedCompanyId),
    user_question:
      toSafeString(stockDraft.user_question) || userMessage,
    wiki_answer: "",
    review_note: "",
    question_category:
      toSafeString(stockDraft.question_category) || "",
    group_key: "",
    canonical_question: "",
    draft_answer:
      toSafeString(stockDraft.draft_answer) || "",
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
  NO_TOPIC_REPLY,
  toSafeString,
  buildFinalReply,
  buildQuestionStockPayload,
  saveStockIfNeeded,
  applyV35Actions,
};