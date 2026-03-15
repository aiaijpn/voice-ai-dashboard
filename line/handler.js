"use strict";

/**
 * line/handler.js
 *
 * LINE Webhook の入口。
 *
 * 役割
 * - LINEイベント受信
 * - ユーザー発言取得
 * - 会話履歴ロード
 * - AI入力テキスト構築
 * - messageService 呼び出し
 * - LINE返信
 *
 * ADR014
 * 保存データとAI入力コンテキストを分離
 *
 * 保存用
 *   userText
 *
 * AI入力用
 *   textForAI
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
 * 会話履歴ストア
 *
 * historyStore は後から実装される可能性があるため
 * 存在すれば使用する設計にしている
 */
let historyStore = null;

try {
  historyStore = require("./historyStore");
  log("🧠 historyStore: OK (./historyStore)");
} catch (e) {
  log("🧠 historyStore: NOT FOUND -> history disabled");
}

/**
 * 履歴最大数
 */
const HISTORY_MAX = Number(process.env.HISTORY_MAX || 10);

/**
 * AI入力用テキスト生成
 *
 * 目的
 * OpenAIへ渡すプロンプトに
 * 直近会話を含める
 *
 * 重要
 * このデータは
 * 「保存してはいけない」
 *
 * ADR014
 * AI入力専用
 */
function buildTextWithHistory(userText, history = []) {

  if (!history || history.length === 0) {
    return userText;
  }

  const lines = history
    .slice(-HISTORY_MAX)
    .map((m) => {

      const role = m.role === "assistant" ? "AI" : "User";

      const content = String(m.content || "")
        .replace(/\s+/g, " ")
        .trim();

      return `${role}: ${content}`;

    })
    .join("\n");

  return `【直近の会話】
${lines}

【今回】
User: ${userText}`;
}


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
    if (event.type !== "message" || event.message.type !== "text") {

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
     * 履歴キー
     */
    const historyKey = `${bot_id}:${userId || "no_userId"}`;

    /**
     * 会話履歴ロード
     */
    let history = [];

    if (historyStore?.getHistory) {

      try {

        history = await historyStore.getHistory(historyKey);

        log(`🧠 [${rid}] history loaded len=${history.length}`);

      } catch (e) {

        log(`history load error`, e.message);

      }

    }

    /**
     * ユーザー発言履歴保存
     */
    if (historyStore?.appendMessage) {

      try {

        await historyStore.appendMessage(historyKey, {
          role: "user",
          content: userText,
        });

        history = await historyStore.getHistory(historyKey);

      } catch (e) {

        log(`history append error`, e.message);

      }

    }

    /**
     * AI入力テキスト生成
     *
     * 保存データとは完全に分離する
     */
    const textForAI = buildTextWithHistory(userText, history);

    log(`🧠 [${rid}] textForAI prepared`);

    /**
     * messageService 呼び出し
     *
     * ADR014
     *
     * text
     *   保存用ユーザー発言
     *
     * aiInputText
     *   AI入力用履歴付きテキスト
     */
    const result = await processMessage({

      rid,
      bot_id,
      userId,

      text: userText,
      aiInputText: textForAI,

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
     * AI発言履歴保存
     */
    if (historyStore?.appendMessage) {

      try {

        await historyStore.appendMessage(historyKey, {
          role: "assistant",
          content: replyText,
        });

      } catch (e) {

        log(`history append error`, e.message);

      }

    }

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