"use strict";

/**
 * line/handler.js
 *
 * LINE Webhook の入口
 *
 * ADR-015
 * 会話履歴は historyService に統一
 * handler では履歴管理を行わない
 *
 * handler の責務
 * - LINEイベント受信
 * - ユーザー入力取得
 * - messageService 呼び出し
 * - LINE返信
 * - 既読処理
 */

const { log, error: logError } = require("../utils/logger");
const axios = require("axios");

const { processMessage } = require("../services/messageService/index");
const lineSender = require("../modules/lineSender");

log("📦 handler.js loaded:", new Date().toISOString());

/**
 * LINEアクセストークン
 */
const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;

log("🔧 ENV CHECK (handler)");
log(" - CHANNEL_ACCESS_TOKEN:", CHANNEL_ACCESS_TOKEN ? "OK" : "MISSING");

/**
 * LINEイベント処理
 */
const handleEvent = async (event, ctx = {}) => {

  const rid = Math.random().toString(16).slice(2, 8);

  try {

    log("========================================");
    log(`➡️ [${rid}] handleEvent start`);
    log(`type=${event.type}`);
    log(`messageType=${event.message?.type}`);

    /**
     * テキストメッセージ以外は処理しない
     */
    if (event.type !== "message" || event.message?.type !== "text") {

      log(`⚠️ [${rid}] Not text message`);
      return;

    }

    /**
     * ユーザー発言
     */
    const userText = event.message.text;

    log(`📝 [${rid}] userText=`, userText);

    const markAsReadToken = event.message?.markAsReadToken;

    /**
     * コンテキスト情報
     */
    const tone = String(ctx.tone || "polite");

    const bot_id = process.env.BOT_ID || "voice-ai-dashboard";

    const userId = event.source?.userId || "";

    /**
     * messageService 呼び出し
     *
     * ADR-015
     * 履歴処理は service 層で実行
     */
    const result = await processMessage({

      rid,
      bot_id,
      userId,

      text: userText,
      aiInputText: userText,

      tone,

    });

    /**
     * AI処理失敗
     */
    if (!result?.success) {

      logError(`❌ [${rid}] service fail:`, result?.message || "unknown error");

      return;

    }

    /**
     * AI返信
     */
    const replyText = result?.data?.replyText || "受信しました";

    log(`🧩 [${rid}] service result message=`, result.message);
    log(`🧩 [${rid}] service replyText=`, replyText);

    /**
     * LINE返信
     */
    log(`📤 [${rid}] sending reply`);

    const sendResult = await lineSender.sendReply(

      event.replyToken,

      [
        {
          type: "text",
          text: replyText,
        },
      ]

    );

    if (!sendResult?.success) {

      logError(`❌ [${rid}] LINE send failed:`, sendResult?.message || "unknown error");

      return;

    }

    log(`🎉 [${rid}] LINE reply success`);

    /**
     * 既読処理
     */
    if (markAsReadToken) {

      try {

        await axios.post(
          "https://api.line.me/v2/bot/chat/markAsRead",
          { markAsReadToken },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
            },
          }
        );

        log(`👁️ [${rid}] markAsRead success`);

      } catch (e) {

        log(`markAsRead failed`, e.message);

      }

    }

    log(`⬅️ [${rid}] handleEvent done`);

  } catch (e) {

    logError("💥 Handler error:", e.response?.data || e.message || e);

  }

};

module.exports = {
  handleEvent,
};