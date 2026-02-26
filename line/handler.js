"use strict";

const axios = require("axios");
const { appendRow, appendUsageRow } = require("../sheet/saver");

console.log("📦 handler.js loaded:", new Date().toISOString());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

console.log("🔧 ENV CHECK (handler)");
console.log(" - OPENAI_API_KEY:", OPENAI_API_KEY ? "OK" : "MISSING");
console.log(" - CHANNEL_ACCESS_TOKEN:", CHANNEL_ACCESS_TOKEN ? "OK" : "MISSING");
console.log(" - OPENAI_MODEL:", OPENAI_MODEL);

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
    const toneGuideMap = {
      polite: "丁寧で落ち着いた敬語。短く要点のみ。",
      casual: "親しみやすくフランク。馴れ馴れしすぎない。短く。",
      sales: "提案型。メリットを1つ示し、押し売りせず次の一歩を添える。短く。",
      gentle: "やさしく安心感。相手の気持ちを尊重しつつ短く。",
    };
    const toneGuide = toneGuideMap[tone] || toneGuideMap.polite;

    const systemPrompt = `
あなたはLINE上のAIアシスタント。
出力は必ず指定JSONスキーマに一致させること（余計なキー禁止）。
reply_text は次の口調ルールに従う：${toneGuide}
summary/category/urgency_score は口調の影響を受けず、内容理解に基づいて返すこと。
`.trim();

    // ===== OpenAI Structured Output（新API対応）=====
    console.log(`🤖 [${rid}] calling OpenAI...`);

    const response = await axios.post(
      "https://api.openai.com/v1/responses",
      {
        model: OPENAI_MODEL,
        input: [
          { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
          { role: "user", content: [{ type: "input_text", text: userText }] },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "voice_analysis",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                reply_text: { type: "string" },
                summary: { type: "string" },
                category: { type: "number" },
                urgency_score: { type: "number" },
              },
              required: ["reply_text", "summary", "category", "urgency_score"],
            },
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    console.log(`✅ [${rid}] OpenAI response received`);

    // ===== Usage 保存（課金可視化）=====
    const usage = response.data.usage || {};
    const inputTokens = usage.input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;
    const totalTokens = usage.total_tokens ?? (inputTokens + outputTokens);

    // まずは gpt-4o-mini 前提の推定単価（USD / 1M tokens）
    const IN_PER_M = 0.15;
    const OUT_PER_M = 0.60;

    const costUsd =
      (inputTokens / 1_000_000) * IN_PER_M + (outputTokens / 1_000_000) * OUT_PER_M;

    const usdJpy = Number(process.env.USDJPY || 150);
    const costJpy = costUsd * usdJpy;

    // model / resp_id
    const modelUsed = response.data.model || OPENAI_MODEL;
    const respId = response.data.id || "";

    try {
      if (appendUsageRow) {
        await appendUsageRow({
          ts: new Date().toISOString(),
          bot_id: String(ctx.bot_id || ctx.botId || "unknown"),
          model: modelUsed,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: totalTokens,
          cost_usd: costUsd,
          cost_jpy: costJpy,
          rid,
          resp_id: respId,
        });
        console.log(`✅ [${rid}] UsageLog append success`);
      } else {
        console.log(`⚠️ [${rid}] appendUsageRow not found (skip usage log)`);
      }
    } catch (e) {
      console.error(`⚠️ [${rid}] UsageLog append failed:`, e?.message || e);
    }


    

    const parsed = JSON.parse(response.data.output[0].content[0].text);
    console.log(`📊 [${rid}] parsed result=`, parsed);

    // ===== Google Sheets 保存 =====
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

    // ===== LINE返信 =====
    console.log(`📤 [${rid}] Sending reply to LINE...`);

    await axios.post(
      "https://api.line.me/v2/bot/message/reply",
      {
        replyToken: event.replyToken,
        messages: [{ type: "text", text: parsed.reply_text }],
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



