"use strict";

/**
 * ============================================
 * 🔒 messageService/index.js 契約（V3.7+固定）
 * ============================================
 *
 * 【役割（絶対遵守）】
 * このファイルは「司令塔」であり、以下のみを行う。
 *
 * 1. 入力受け取り
 *    - userMessage
 *    - userId
 *    - bot_id
 *    - rid
 *
 * 2. 会話履歴取得
 *    - historyService から履歴を取得する
 *    - 履歴の意味判断はしない
 *
 * 3. 履歴整形処理の呼び出し
 *    - normalizeConversationHistory を呼ぶ
 *    - 自分では normalize ルールを持たない
 *
 * 4. 会話エンジン呼び出し
 *    - runConversationEngine を呼ぶ
 *    - 実際に v35 / v37 のどちらを使うかは conversationEngine に委譲する
 *    - 会話の最終判断は conversationEngine 配下へ委譲する
 *
 * 5. 結果保存
 *    - conversation_history へ user_message / ai_reply を保存する
 *    - 保存値は conversationEngine の最終結果をそのまま使う
 *
 * 6. handler返却形式へ整形
 *    - buildReply を使って返却データを組み立てる
 *    - ただし companyId / topicLabel の再決定はしない
 *
 * --------------------------------------------
 * 【このファイルが絶対にやってはいけないこと】
 *
 * ❌ AIロジックの実装
 *    - 判断
 *    - 分類
 *    - 推論
 *
 * ❌ company判定ロジックの実装
 * ❌ topicLabel 決定ロジックの実装
 * ❌ 会話継続ロジックの実装
 * ❌ prompt生成ロジックの実装
 * ❌ 会話エンジン結果の補正・上書き
 * ❌ currentCompanyId / matchedCompanyId の再解釈
 *
 * ❌ 会話意味に関わるデータ変換ロジックの新規追加
 *    例:
 *    - companyId の補正
 *    - topicLabel の生成
 *    - 継続判定の追加
 *    - normalize rule の追加
 *
 * ❌ if / switch による条件分岐の肥大化
 *
 * → 上記はすべて外部サービスへ委譲すること。
 *
 * --------------------------------------------
 * 【責務境界（どこに書くべきか）】
 *
 * - AI判断 / 分類 / 会話ロジック / 最終意思決定
 *   → services/conversationEngine/
 *   → services/v35/
 *   → services/v37/
 *
 * - 履歴取得 / 保存
 *   → services/historyService
 *
 * - 履歴整形（shape の統一）
 *   → services/conversationContext/normalizeConversationHistory
 *
 * - 返信データ整形（handler返却用）
 *   → services/messageService/buildReply
 *
 * --------------------------------------------
 * 【設計原則】
 *
 * - このファイルは「薄く保つ」ことが最重要
 * - 1ファイル1責務（司令塔のみ）
 * - ここは「考える場所」ではなく「流す場所」
 * - 変更理由の大半は conversationEngine 側で解決する
 * - index.js に判断ロジックを足す = 設計負債
 *
 * --------------------------------------------
 * 【正本ルール】
 *
 * - companyId の正本
 *   → runConversationEngine().data.companyId
 *
 * - matchedCompanyId の正本
 *   → runConversationEngine().data.matchedCompanyId
 *
 * - topicLabel の正本
 *   → runConversationEngine().data.topicLabel
 *
 * - replyText の正本
 *   → runConversationEngine().data.replyText
 *
 * このファイルは上記を再決定しない。
 * 再注入しない。
 * 上書きしない。
 *
 * --------------------------------------------
 * 【このファイルで許される処理】
 *
 * ✅ 入力チェック
 * ✅ 履歴取得
 * ✅ normalizeConversationHistory の呼び出し
 * ✅ runConversationEngine の呼び出し
 * ✅ 保存
 * ✅ ログ出力
 * ✅ handler返却用データ整形
 *
 * ※ ただし「意味判断」を含まないこと。
 *
 * --------------------------------------------
 * 【異常検知ルール】
 *
 * 以下が発生したら設計崩れのサイン。
 *
 * - 修正回数が急増（目安: 月10回超）
 * - if文 / switch文 が増え続ける
 * - 100行以上のロジック追加が必要になる
 * - 「ここで少し判定した方が早い」が出てくる
 * - 会話エンジンの結果をここで補正したくなる
 * - normalizeConversationHistory に無い変換をここへ足したくなる
 *
 * → その変更はこのファイルではなく、
 *   conversationEngine / v35 / v37 / conversationContext / 専用サービスへ切り出すこと。
 *
 * --------------------------------------------
 * 【最重要メッセージ】
 *
 * 👉 index.js は「考えるな、指示だけ出せ」
 * 👉 入口で賢くなるな。司令塔のままでいろ。
 *
 * ============================================
 */

const { log, error: logError } = require("../../utils/logger");
const { success, fail } = require("../../utils/serviceResponse");
const {
  normalizeConversationHistory,
} = require("../conversationContext/normalizeConversationHistory");

const {
  saveConversationHistory,
  getConversationHistory,
} = require("../historyService");

const {
  getCommandState,
  setPendingThemeConfirm,
  clearPendingThemeConfirm,
} = require("../commandStateService");
const { runConversationEngine } = require("../conversationEngine");
const {
  matchCompanyTheme,
  handlePendingThemeConfirm,
  buildThemeConfirmReply,
} = require("../companyThemePolicy");

const {
  buildProcessMessageSuccessData,
} = require("./buildReply");

log("📦 messageService/index.js loaded:", new Date().toISOString());

const DEFAULT_HISTORY_LIMIT = 8;

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
 * V3.7 会話処理
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

    log(`🧠 [${rid}] V3.7 start`, {
      bot_id,
      userId,
      userMessage,
    });

    /**
     * 0. 会話履歴取得
     * - 今回の userMessage 保存前の履歴を取得する
     * - これを conversationEngine へ渡して継続判定に使う
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
     * コマンド状態取得
     * - ユーザーが設定したエンジン・テーマを反映
     */
    const commandStateResult = await getCommandState({
      botId: bot_id,
      userId,
    });

    const commandState = commandStateResult?.success
      ? commandStateResult.data
      : { currentEngine: "v35", currentTheme: "", pendingThemeConfirm: null };

    let skipThemeMatch = false;

    if (
      commandState.pendingThemeConfirm &&
      Array.isArray(commandState.pendingThemeConfirm.candidates)
    ) {
      const pendingResult = await handlePendingThemeConfirm({
        userMessage,
        pendingThemeConfirm: commandState.pendingThemeConfirm,
        botId: bot_id,
        userId,
      });

      if (pendingResult?.handled) {
        return success(
          {
            replyText: pendingResult.replyText,
            userId,
            bot_id,
            rid,
          },
          "pending theme confirm handled"
        );
      }

      skipThemeMatch = true;
    }

    const forcedTheme = String(commandState.currentTheme || "").trim();

    if (!forcedTheme && !skipThemeMatch) {
      const themeMatchResult = await matchCompanyTheme({ userMessage });

      if (
        Array.isArray(themeMatchResult.candidates) &&
        themeMatchResult.candidates.length > 0
      ) {
        await setPendingThemeConfirm({
          botId: bot_id,
          userId,
          pendingThemeConfirm: {
            originalText: userMessage,
            candidates: themeMatchResult.candidates,
            createdAt: new Date().toISOString(),
          },
        });

        return success(
          {
            replyText: buildThemeConfirmReply(themeMatchResult.candidates),
            userId,
            bot_id,
            rid,
          },
          "pending theme confirm"
        );
      }
    }

    /**
     * 1. 会話エンジン実行
     * - 実際に v35 / v37 のどちらを呼ぶかは conversationEngine に委譲する
     */
    const engineResult = await runConversationEngine({
      rid,
      bot_id,
      userId,
      userMessage,
      conversationHistory,
      currentEngine: commandState.currentEngine || "v35",
      forcedTheme,
    });

    if (!engineResult?.success) {
      logError(
        `❌ [${rid}] runConversationEngine failed:`,
        engineResult?.message || "unknown"
      );

      console.log("### MESSAGE SERVICE DEBUG ENGINE_FAIL ###", {
        rid,
        bot_id,
        userId,
        userMessage,
        engineResult: engineResult?.data || null,
      });

      return fail(engineResult?.message || "runConversationEngine failed", {
        replyText: "",
        userId,
        bot_id,
        rid,
        engineResult: engineResult?.data || null,
      });
    }

    /**
     * 2. 会話エンジン結果取得
     * - engine が返した最終結果をそのまま尊重する
     * - ここで companyId を再注入しない
     */
    const replyText =
      String(engineResult.data?.replyText || "").trim() || "確認しました。";

    const finalCompanyId = String(engineResult.data?.companyId || "").trim();
    const finalMatchedCompanyId = String(
      engineResult.data?.matchedCompanyId || ""
    ).trim();
    const topicLabel = String(engineResult.data?.topicLabel || "").trim();

    log(`🧩 [${rid}] V3.7 result`, {
      topicLabel,
      companyId: finalCompanyId,
      matchedCompanyId: finalMatchedCompanyId,
      historyCount: conversationHistory.length,
    });

    // ===== DEBUG LOGS START =====
    console.log("### MESSAGE SERVICE IN ###", {
      rid,
      engineCompanyId: engineResult?.data?.companyId || "",
      engineMatchedCompanyId: engineResult?.data?.matchedCompanyId || "",
      engineTopicLabel: engineResult?.data?.topicLabel || "",
      engineCurrentCompanyId: engineResult?.data?.currentCompanyId || "",
      engineIsConversationContinuing: Boolean(
        engineResult?.data?.isConversationContinuing
      ),
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
        ...(engineResult.data || {}),
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
     * - engine最終結果をそのまま反映
     */
    return success(successData, "v37 reply");
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