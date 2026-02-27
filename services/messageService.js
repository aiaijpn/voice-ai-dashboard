"use strict";

const axios = require("axios");
const { appendUsageRow } = require("../sheet/saver");

// services/messageService.js
// 役割：LINE受信後の「考える処理」を集約（OpenAI→解析→返信方針）
// 現段階：OpenAI呼び出し＆Usage保存は service に移動済
// 将来：appendRow（本文ログ）も repository/service に移して handler を更に薄くする

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

console.log("📦 messageService.js loaded:", new Date().toISOString());
console.log("🔧 ENV CHECK (service)");
console.log(" - OPENAI_API_KEY:", OPENAI_API_KEY ? "OK" : "MISSING");
console.log(" - OPENAI_MODEL:", OPENAI_MODEL);

const toneGuideMap = {
  polite: "丁寧で落ち着いた敬語。短く要点のみ。",
  casual: "親しみやすくフランク。馴れ馴れしすぎない。短く。",
  sales: "提案型。メリットを1つ示し、押し売りせず次の一歩を添える。短く。",
  gentle: "やさしく安心感。相手の気持ちを尊重しつつ短く。",
};

function safeParseJsonFromResponsesApi(resp) {
  // あなたの現行レスポンス形式に合わせつつ、落ちにくいフォールバックを用意
  const t =
    resp?.data?.output?.[0]?.content?.[0]?.text ||
    resp?.data?.output_text ||
    resp?.data?.text ||
    "";

  if (!t) return null;

  try {
    return JSON.parse(t);
  } catch {
    // たまに前後にゴミが混ざるケース用：最初の { から最後の } を抽出
    const s = String(t);
    const a = s.indexOf("{");
    const b = s.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(s.slice(a, b + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function processMessage(context) {
  const {
    rid = "no_rid",
    bot_id = "voice-ai-dashboard",
    userId = "",
    text = "",
    tone = "polite",
  } = context || {};

  const toneGuide = toneGuideMap[String(tone)] || toneGuideMap.polite;

  const systemPrompt = `
あなたはLINE上のAIアシスタント。
出力は必ず指定JSONスキーマに一致させること（余計なキー禁止）。
reply_text は次の口調ルールに従う：${toneGuide}
summary/category/urgency_score は口調の影響を受けず、内容理解に基づいて返すこと。
`.trim();

  console.log(`🤖 [${rid}] (service) calling OpenAI... tone=${tone}`);

  // ===== OpenAI Structured Output（Responses API）=====
  const response = await axios.post(
    "https://api.openai.com/v1/responses",
    {
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text }] },
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

  console.log(`✅ [${rid}] (service) OpenAI response received`);

  // ===== Usage 保存（課金可視化）=====
  const usage = response.data.usage || {};
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? (inputTokens + outputTokens);

  // gpt-4o-mini 想定の推定単価（USD / 1M tokens）
  const IN_PER_M = 0.15;
  const OUT_PER_M = 0.60;

  const costUsd =
    (inputTokens / 1_000_000) * IN_PER_M + (outputTokens / 1_000_000) * OUT_PER_M;

  const usdJpy = Number(process.env.USDJPY || 150);
  const costJpy = costUsd * usdJpy;

  const modelUsed = response.data.model || OPENAI_MODEL;
  const respId = response.data.id || "";

  try {
    if (appendUsageRow) {
      await appendUsageRow({
        ts: new Date().toISOString(),
        bot_id,
        model: modelUsed,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        cost_usd: costUsd,
        cost_jpy: costJpy,
        rid,
        resp_id: respId,
      });
      console.log(`✅ [${rid}] (service) UsageLog append success`);
    } else {
      console.log(`⚠️ [${rid}] (service) appendUsageRow not found (skip usage log)`);
    }
  } catch (e) {
    console.error(`⚠️ [${rid}] (service) UsageLog append failed:`, e?.message || e);
  }

  // ===== parse =====
  const parsed = safeParseJsonFromResponsesApi(response);
  console.log(`📊 [${rid}] (service) parsed=`, parsed);

  // 最低限のフォールバック
  const replyText =
    parsed?.reply_text ||
    (text ? `受信しました：${text}` : "受信しました");

  return {
    replyText,
    ai: parsed, // handler が Sheets に保存するため渡す
    meta: {
      bot_id,
      userId,
      model: modelUsed,
      resp_id: respId,
      tokens: { inputTokens, outputTokens, totalTokens },
      cost: { usd: costUsd, jpy: costJpy },
    },
  };
}

module.exports = { processMessage };
