"use strict";

/**
 * buildConversationContext
 *
 * 役割:
 * - 会話履歴を取得する
 * - V35へ渡すための会話文脈を構築する
 * - messageService から見た「会話継続の入口」を一本化する
 *
 * 方針:
 * - 履歴取得責務を conversationContext に集約
 * - V35 へは主に conversationHistory を渡す
 * - latestCompanyId は補助情報として返す
 */

const historyService = require("../historyService");

async function buildConversationContext(params = {}) {
  try {
    const botId = String(params.botId || "").trim();
    const userId = String(params.userId || "").trim();
    const limit = Number.isFinite(Number(params.limit)) ? Number(params.limit) : 8;

    if (!botId) {
      return {
        success: false,
        message: "botId is required",
        data: null,
      };
    }

    if (!userId) {
      return {
        success: false,
        message: "userId is required",
        data: null,
      };
    }

    if (
      !historyService ||
      typeof historyService.getConversationHistory !== "function"
    ) {
      return {
        success: false,
        message: "historyService.getConversationHistory is not available",
        data: null,
      };
    }

    const historyRes = await historyService.getConversationHistory({
      botId,
      userId,
      limit,
    });

    const conversationHistory = normalizeConversationHistory(
      historyRes && historyRes.success && historyRes.data
        ? historyRes.data.items || historyRes.data.history || []
        : []
    );

    let latestCompanyId = "";

    if (
      historyService &&
      typeof historyService.getLatestCompanyIdFromHistory === "function"
    ) {
      try {
        const latestCompanyRes =
          await historyService.getLatestCompanyIdFromHistory({
            botId,
            userId,
          });

        latestCompanyId = String(
          (latestCompanyRes &&
            latestCompanyRes.success &&
            latestCompanyRes.data &&
            (latestCompanyRes.data.companyId ||
              latestCompanyRes.data.latestCompanyId ||
              latestCompanyRes.data.currentCompanyId)) ||
            ""
        ).trim();
      } catch (_err) {
        latestCompanyId = "";
      }
    }

    const isConversationContinuing =
      Array.isArray(conversationHistory) && conversationHistory.length > 0;

    return {
      success: true,
      message: "conversation context built",
      data: {
        conversationHistory,
        latestCompanyId,
        isConversationContinuing,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `failed to build conversation context: ${error.message}`,
      data: null,
    };
  }
}

/**
 * 履歴を V35 に渡しやすい最小形へ正規化
 */
function normalizeConversationHistory(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const role = detectRole(item);
      const text = extractText(item);
      const companyId = extractCompanyId(item);
      const timestamp = extractTimestamp(item);
      const sourceType = extractSourceType(item);

      return {
        role,
        text,
        companyId,
        timestamp,
        sourceType,
        raw: item,
      };
    })
    .filter((item) => item.text);
}

function detectRole(item) {
  const sourceType = String(
    (item && (item.sourceType || item.source_type || item.type)) || ""
  ).trim();

  if (sourceType === "user_message") return "user";
  if (sourceType === "ai_reply") return "assistant";
  if (sourceType === "admin_message") return "assistant";

  if (item && typeof item.role === "string" && item.role.trim()) {
    return item.role.trim();
  }

  if (item && item.userMessage) return "user";
  if (item && item.aiReply) return "assistant";

  return "unknown";
}

function extractText(item) {
  return String(
    (item &&
      (item.text ||
        item.message ||
        item.userMessage ||
        item.user_message ||
        item.aiReply ||
        item.ai_reply ||
        item.content)) ||
      ""
  ).trim();
}

function extractCompanyId(item) {
  return String(
    (item &&
      (item.companyId ||
        item.company_id ||
        item.currentCompanyId ||
        item.matchedCompanyId)) ||
      ""
  ).trim();
}

function extractTimestamp(item) {
  return String(
    (item &&
      (item.timestamp || item.createdAt || item.created_at || item.date)) ||
      ""
  ).trim();
}

function extractSourceType(item) {
  return String(
    (item &&
      (item.sourceType || item.source_type || item.type || item.role)) ||
      ""
  ).trim();
}

module.exports = {
  buildConversationContext,
};