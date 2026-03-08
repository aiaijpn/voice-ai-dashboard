// ファイル: voice-ai-dashboard/line/handler.js
"use strict";

const { log, error: logError } = require("../utils/logger");
const axios = require("axios");
const { processMessage } = require("../services/messageService");

log("📦 handler.js loaded:", new Date().toISOString());

const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;

log("🔧 ENV CHECK (handler)");
log(" - CHANNEL_ACCESS_TOKEN:", CHANNEL_ACCESS_TOKEN ? "OK" : "MISSING");

// historyStore は STEP2 で新規作成する想定。
// 先に handler.js を直しても落ちないように「存在すれば使う」方式
let historyStore = null;

try {
  historyStore = require("./historyStore");
  log("🧠 historyStore: OK (./historyStore)");
} catch (e) {
  log("🧠 historyStore: NOT FOUND -> history disabled");
}

const HISTORY_MAX = Number(process.env.HISTORY_MAX || 10);

function buildTextWithHistory(userText, history = []) {
  if (!history || history.length === 0) return userText;

  const lines = history
    .slice(-HISTORY_MAX)
    .map((m) => {
      const role = m.role === "assistant" ? "AI" : "User";
      const content = String(m.content || "").replace(/\s+/g, " ").trim();
      return `${role}: ${content}`;
    })
    .join("\n");

  return `【直近の会話】\n${lines}\n\n【今回】\nUser: ${userText}`;
}

const handleEvent = async (event, ctx = {}) => {
  const rid = Math.random().toString(16).slice(2, 8);

  try {
    log("========================================");
    log(`➡️ [${rid}] handleEvent start`);
    log(`type=${event.type}`);
    log(`messageType=${event.message?.type}`);

    if (event.type !== "message" || event.message.type !== "text") {
      log(`⚠️ [${rid}] Not text message`);
      return;
    }

    const userText = event.message.text;
    log(`📝 [${rid}] userText=`, userText);

    const markAsReadToken = event.message?.markAsReadToken;

    const tone = String(ctx.tone || "polite");
    const bot_id = process.env.BOT_ID || "voice-ai-dashboard";
    const userId = event.source?.userId || "";

    const historyKey = `${bot_id}:${userId || "no_userId"}`;

    // ===== 履歴ロード =====
    let history = [];

    if (historyStore?.getHistory) {
      try {
        history = await historyStore.getHistory(historyKey);
        log(`🧠 [${rid}] history loaded len=${history.length}`);
      } catch (e) {
        log(`history load error`, e.message);
      }
    }

    // ===== ユーザー発言保存 =====
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

    const textForAI = buildTextWithHistory(userText, history);

    // ===== AI処理 =====
    const replyText =
      (await processMessage({
        rid,
        bot_id,
        userId,
        text: textForAI,
        tone,
      })) || "受信しました";

    log(`🧩 [${rid}] service replyText=`, replyText);

    // ===== AI発言履歴保存 =====
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

    // ===== LINE返信 =====
    log(`📤 [${rid}] sending reply`);

    await axios.post(
      "https://api.line.me/v2/bot/message/reply",
      {
        replyToken: event.replyToken,
        messages: [{ type: "text", text: replyText }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        },
        timeout: 15000,
      }
    );

    log(`🎉 [${rid}] LINE reply success`);

    // ===== 既読 =====
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

module.exports = { handleEvent };