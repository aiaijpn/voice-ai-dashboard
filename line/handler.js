// ファイル: voice-ai-dashboard/line/handler.js
"use strict";

const { log } = require("../utils/logger");　//logラッパー 2026/3/1

const axios = require("axios");
const { processMessage } = require("../services/messageService");

console.log("📦 handler.js loaded:", new Date().toISOString());

const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;

console.log("🔧 ENV CHECK (handler)");
console.log(" - CHANNEL_ACCESS_TOKEN:", CHANNEL_ACCESS_TOKEN ? "OK" : "MISSING");

// historyStore は STEP2 で新規作成する想定。
// 先に handler.js を直しても落ちないように「存在すれば使う」方式にしてある。
let historyStore = null;
try {
  historyStore = require("./historyStore");
  console.log("🧠 historyStore: OK (./historyStore)");
} catch (e) {
  console.log("🧠 historyStore: NOT FOUND (STEP2で追加予定) -> history disabled for now");
}

const HISTORY_MAX = Number(process.env.HISTORY_MAX || 10); // 直近N件（role単位）

/**
 * 履歴をAIに混ぜるための軽量フォーマット
 * ※ processMessage 側を触らなくても、textに混ぜれば会話が繋がる
 */
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
    console.log("========================================");
    console.log(`➡️ [${rid}] handleEvent start`);
    console.log(`   type=${event.type}`);
    console.log(`   messageType=${event.message?.type}`);

    if (event.type !== "message" || event.message.type !== "text") {
      console.log(`⚠️ [${rid}] Not a text message. Skip.`);
      return;
    }

    const userText = event.message.text;
    console.log(`📝 [${rid}] userText=`, userText);

    // ===== 既読トークン（2025/11〜 Messaging API）=====
    const markAsReadToken = event.message?.markAsReadToken;
    console.log(`👁️ [${rid}] markAsReadToken=`, markAsReadToken ? "FOUND" : "NONE");

    const tone = String(ctx.tone || "polite");
    const bot_id = process.env.BOT_ID || "voice-ai-dashboard";
    const userId = event.source?.userId || "";
    const historyKey = `${bot_id}:${userId || "no_userId"}`;

    // ===== 履歴ロード（あれば）=====
    let history = [];
    if (historyStore?.getHistory) {
      try {
        history = await historyStore.getHistory(historyKey);
        console.log(`🧠 [${rid}] history loaded: key=${historyKey} len=${history.length}`);
      } catch (e) {
        console.log(`🧠 [${rid}] history load failed:`, e.message || e);
      }
    } else {
      console.log(`🧠 [${rid}] historyStore disabled -> skip load`);
    }

    // ===== 今回ユーザー発言を履歴に保存（あれば）=====
    if (historyStore?.appendMessage) {
      try {
        await historyStore.appendMessage(historyKey, { role: "user", content: userText });
        console.log(`🧠 [${rid}] history appended (user)`);
        // append後、最新を再取得（N件制限はstore側でもOKだが念のため）
        history = await historyStore.getHistory(historyKey);
      } catch (e) {
        console.log(`🧠 [${rid}] history append(user) failed:`, e.message || e);
      }
    }

    // ===== 履歴をテキストに混ぜる（store無しでもOK）=====
    const textForAI = buildTextWithHistory(userText, history);
    if (history.length > 0) {
      console.log(`🧾 [${rid}] textForAI includes history (len=${history.length})`);
    }

    // ===== serviceへ委譲 =====
    const svc = await processMessage({
      rid,
      bot_id,
      userId,
      text: textForAI,
      tone,
      timestamp: Date.now(),
      rawEvent: event,
      // もし processMessage 側が history を扱えるようになったら、そのまま使える
      history: history.slice(-HISTORY_MAX),
    });

    const replyText = svc?.replyText || "受信しました";
    console.log(`🧩 [${rid}] service replyText=`, replyText);

    // ===== AI返答を履歴に保存（あれば）=====
    if (historyStore?.appendMessage) {
      try {
        await historyStore.appendMessage(historyKey, { role: "assistant", content: replyText });
        console.log(`🧠 [${rid}] history appended (assistant)`);
      } catch (e) {
        console.log(`🧠 [${rid}] history append(assistant) failed:`, e.message || e);
      }
    }

    // ===== LINE返信 =====
    console.log(`📤 [${rid}] Sending reply to LINE...`);

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

    console.log(`🎉 [${rid}] LINE reply success`);

    // ===== 既読付与（2025/11〜 Messaging API）=====
    // token が無い場合はスキップ。失敗しても返信は止めない（温度維持優先）
    if (markAsReadToken) {
      try {
        console.log(`👁️ [${rid}] Marking as read...`);
        await axios.post(
          "https://api.line.me/v2/bot/chat/markAsRead",
          { markAsReadToken },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
            },
            timeout: 15000,
          }
        );
        console.log(`✅ [${rid}] markAsRead success`);
      } catch (e) {
        console.log(`⚠️ [${rid}] markAsRead failed:`, e.response?.data || e.message || e);
      }
    } else {
      console.log(`👁️ [${rid}] markAsRead skipped (no token)`);
    }

    console.log(`⬅️ [${rid}] handleEvent done`);
  } catch (error) {
    console.error("💥 Handler error:", error.response?.data || error.message || error);
  }
};

module.exports = { handleEvent };


