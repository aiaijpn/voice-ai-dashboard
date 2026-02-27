"use strict";

const axios = require("axios");
const { appendRow } = require("../sheet/saver");
const { processMessage } = require("../services/messageService");

console.log("📦 handler.js loaded:", new Date().toISOString());

const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;

console.log("🔧 ENV CHECK (handler)");
console.log(" - CHANNEL_ACCESS_TOKEN:", CHANNEL_ACCESS_TOKEN ? "OK" : "MISSING");

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

    const tone = String(ctx.tone || "polite");

    // ===== serviceへ委譲（OpenAI呼び出しも service側）=====
    const svc = await processMessage({
      rid,
      bot_id: process.env.BOT_ID || "voice-ai-dashboard",
      userId: event.source?.userId || "",
      text: userText,
      tone,
      timestamp: Date.now(),
      rawEvent: event,
    });

    const parsed = svc?.ai;
    const replyText = svc?.replyText || "受信しました";
    console.log(`🧩 [${rid}] service replyText=`, replyText);

    // ===== Google Sheets 保存（従来通り）=====
    if (parsed) {
      console.log(`📄 [${rid}] Saving to Google Sheets...`);

      await appendRow({
        timestamp: new Date().toISOString(),
        user_text: userText,
        summary: parsed.summary,
        category: parsed.category,
        urgency_score: parsed.urgency_score,
        reply_text: parsed.reply_text,
      });

      console.log(`✅ [${rid}] Sheet append success`);
    } else {
      console.log(`⚠️ [${rid}] parsed(ai) is empty. Skip sheet append.`);
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
    console.log(`⬅️ [${rid}] handleEvent done`);
  } catch (error) {
    console.error("💥 Handler error:", error.response?.data || error.message || error);
  }
};

module.exports = { handleEvent };
