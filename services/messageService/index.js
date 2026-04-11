"use strict";

/**
 * services/messageService/index.js
 *
 * V3.6 接続版
 *
 * 役割:
 * - LINE handler から受けた userMessage を V3.6 へ渡す
 * - 会話履歴を取得して V35 に渡す
 * - V3.6の返答を conversation_history に保存する
 * - handler が使う replyText を返す
 *
 * 方針:
 * - 会話ロジック本体は services/v35/ に集約
 * - 会話継続に必要な履歴取得だけをここで行う
 * - messageService は入口と保存に絞る
 */

const { log, error: logError } = require("../../utils/logger");
const { success, fail } = require("../../utils/serviceResponse");

const {
  saveConversationHistory,
  getConversationHistory,
} = require("../historyService");

const { runV35 } = require("../v35");

const {
  buildProcessMessageSuccessData,
} = require("./buildReply");

log("📦 messageService/index.js loaded:", new Date().toISOString());

const DEFAULT_HISTORY_LIMIT = 8;

/**
 * 取得履歴を V35 に渡しやすい形へ整える
 * repository / historyService 側の返り値揺れをここで吸収する
 */
function normalizeConversationHistory(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      const sourceType = String(
        item?.sourceType || item?.source_type || item?.type || ""
      ).trim();

      let role = "unknown";
      if (sourceType === "user_message") role = "user";
      if (sourceType === "ai_reply" || sourceType === "admin_message") {
        role = "assistant";
      }

      const text = String(
        item?.userMessage ||
          item?.user_message ||
          item?.aiReply ||
          item?.ai_reply ||
          item?.text ||
          item?.message ||
          ""
      ).trim();

      const companyId = String(
        item?.companyId ||
          item?.company_id ||
          item?.matchedCompanyId ||
          item?.matched_company_id ||
          ""
      ).trim();

      const companyName = String(
        item?.companyName ||
          item?.company_name ||
          item?.matchedCompanyName ||
          item?.matched_company_name ||
          ""
      ).trim();

      return {
        role,
        text,
        companyId,
        companyName,
        sourceType,
        timestamp: item?.timestamp || "",
      };
    })
    .filter((item) => item.text);
}

/**
 * 会話履歴を取得する
 */
async function loadConversationHistory({ bot_id, userId, rid }) {
  try {
    const historyResult = await getConversationHistory({
      botId: bot_id,
      userId,
      limit: DEFAULT_HISTORY_LIMIT,
    });

    if (!historyResult?.success) {
      logError(
        `❌ [${rid}] getConversationHistory failed:`,
        historyResult?.message || "unknown"
      );

      return {
        success: false,
        message: historyResult?.message || "getConversationHistory failed",
        data: {
          items: [],
        },
      };
    }

    const rawItems = Array.isArray(historyResult.data?.items)
      ? historyResult.data.items
      : [];

    const items = normalizeConversationHistory(rawItems);

    log(`📚 [${rid}] conversation history loaded`, {
      bot_id,
      userId,
      historyCount: items.length,
      latestCompanyId:
        [...items].reverse().find((row) => row.companyId)?.companyId || "",
    });

    return {
      success: true,
      message: "conversation history loaded",
      data: {
        items,
      },
    };
  } catch (error) {
    logError(
      `❌ [${rid}] loadConversationHistory failed:`,
      error?.message || error
    );

    return {
      success: false,
      message: error?.message || "loadConversationHistory failed",
      data: {
        items: [],
      },
    };
  }
}

/**
 * V3.6 会話処理
 *
 * @param {Object} context
 * @param {string} context.rid
 * @param {string} context.bot_id
 * @param {string} context.userId
 * @param {string} context.text
 * @returns {Promise<{success:boolean,message:string,data:any}>}
 */
async function processMessage(context = {}) {
  const {
    rid = "no_rid",
    bot_id = "voice-ai-dashboard",
    userId = "",
    text = "",
  } = context;

  try {
    const userMessage = String(text || "").trim();

    if (!userId) {
      return fail("processMessage: userId is required", {
        replyText: "",
        userId,
        bot_id,
        rid,
      });
    }

    if (!userMessage) {
      return fail("processMessage: text is required", {
        replyText: "",
        userId,
        bot_id,
        rid,
      });
    }

    log(`🧠 [${rid}] V3.6 start`, {
      bot_id,
      userId,
      userMessage,
    });

    /**
     * 0. 会話履歴取得
     * - 今回の userMessage 保存前の履歴を取得する
     * - これを V35 へ渡して継続判定に使う
     */
    const historyResult = await loadConversationHistory({
      bot_id,
      userId,
      rid,
    });

    const conversationHistory = Array.isArray(historyResult?.data?.items)
      ? historyResult.data.items
      : [];

    /**
     * 1. V3.6 実行
     */
    const v35Result = await runV35({
      rid,
      bot_id,
      userId,
      userMessage,
      conversationHistory,
    });

    if (!v35Result?.success) {
      logError(`❌ [${rid}] runV35 failed:`, v35Result?.message || "unknown");

      console.log("### MESSAGE SERVICE DEBUG RUNV35_FAIL ###", {
        rid,
        bot_id,
        userId,
        userMessage,
        v35Result: v35Result?.data || null,
      });

      return fail(v35Result?.message || "runV35 failed", {
        replyText: "",
        userId,
        bot_id,
        rid,
        v35Result: v35Result?.data || null,
      });
    }

    /**
     * 2. V3.6 結果取得
     * - V35が返した最終結果をそのまま尊重する
     * - ここで companyId を再注入しない
     */
    const replyText =
      String(v35Result.data?.replyText || "").trim() || "確認しました。";

    const finalCompanyId = String(v35Result.data?.companyId || "").trim();
    const finalMatchedCompanyId = String(
      v35Result.data?.matchedCompanyId || ""
    ).trim();
    const topicLabel = String(v35Result.data?.topicLabel || "").trim();

    log(`🧩 [${rid}] V3.6 result`, {
      topicLabel,
      companyId: finalCompanyId,
      matchedCompanyId: finalMatchedCompanyId,
      historyCount: conversationHistory.length,
    });

    // ===== DEBUG LOGS START =====
    console.log("### MESSAGE SERVICE IN ###", {
      rid,
      v35CompanyId: v35Result?.data?.companyId || "",
      v35MatchedCompanyId: v35Result?.data?.matchedCompanyId || "",
      v35TopicLabel: v35Result?.data?.topicLabel || "",
      v35CurrentCompanyId: v35Result?.data?.currentCompanyId || "",
      v35IsConversationContinuing: Boolean(v35Result?.data?.isConversationContinuing),
    });

    console.log("### MESSAGE SERVICE NORMALIZED ###", {
      rid,
      finalCompanyId,
      finalMatchedCompanyId,
      topicLabel,
      historyCount: conversationHistory.length,
    });
    // ===== DEBUG LOGS END =====

    /**
     * 3. 履歴保存
     * - user_message
     * - ai_reply
     *
     * no_topic のときは finalCompanyId が空のまま保存される
     */
    await saveConversationHistory({
      botId: bot_id,
      userId,
      userMessage,
      sourceType: "user_message",
      companyId: finalCompanyId,
    });

    await saveConversationHistory({
      botId: bot_id,
      userId,
      aiReply: replyText,
      sourceType: "ai_reply",
      companyId: finalCompanyId,
    });

    const successData = buildProcessMessageSuccessData({
      finalReply: replyText,
      parsed: {
        ...(v35Result.data || {}),
        topicLabel,
        matchedCompanyId: finalMatchedCompanyId,
        companyId: finalCompanyId,
        conversationHistoryCount: conversationHistory.length,
      },
      userId,
      bot_id,
      rid,
    });

    console.log("### MESSAGE SERVICE OUT ###", {
      rid,
      successCompanyId: successData.companyId || "",
      successMatchedCompanyId: successData.matchedCompanyId || "",
      successTopicLabel: successData.topicLabel || "",
      successCurrentCompanyId: successData.currentCompanyId || "",
    });

    /**
     * 4. handler 返却形式へ整形
     * - companyId / matchedCompanyId を再注入しない
     * - V35最終結果をそのまま反映
     */
    return success(successData, "v36 reply");
  } catch (error) {
    logError(`❌ [${rid}] processMessage failed:`, error?.message || error);

    console.log("### MESSAGE SERVICE DEBUG ERROR ###", {
      rid,
      bot_id,
      userId,
      text,
      error: error?.message || String(error),
    });

    return fail(error?.message || "processMessage failed", {
      replyText: "",
      userId,
      bot_id,
      rid,
    });
  }
}

module.exports = {
  processMessage,
};