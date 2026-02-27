"use strict";

const axios = require("axios");
const { appendUsageRow } = require("../sheet/saver");

// services/messageService.js
// 役割：LINE受信後の「考える処理」を集約（OpenAI→解析→返信）
// 現段階：OpenAI呼び出し＆Usage保存は service
// 将来：appendRow（本文ログ）も repository/service に移す

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

function getRawTextFromResponsesApi(resp) {
  // Responses API は状況により取得パスが揺れるので多段フォールバック
  return (
    resp?.data?.output?.[0]?.content?.[0]?.text ||
    resp?.data?.output_text ||
    resp?.data?.text ||
    ""
  );
}

function tryParseJson(raw) {
  if (!raw) return null;

  // 1) 正攻法
  try {
    return JSON.parse(raw);
  } catch {}

  // 2) 前後ゴミ除去（最初の { ～ 最後の }）
  const s = String(raw);
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try {
      return JSON.parse(s.slice(a, b + 1));
    } catch {}
  }
  return null;
}

function extractReplyText(raw) {
  if (!raw) return "";

  // JSONが壊れてても reply_text だけ抜ければ勝ち
  // "reply_text":"...." を雑に抜く（エスケープ対応は最小）
  const m = String(raw).match(/"reply_text"\s*:\s*"([\s\S]*?)"\s*(,|\})/);
  if (!m) return "";

  // ざっくり unescape（\" と \n 程度）
  return m[1]
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .trim();
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
  console.log(`🧾 [${rid}] (service) text_len=${String(text).length}`);

  const response = await axios.post(
    "https://api.openai.com/v1/responses",
    {
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: String(text) }] },
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
    }
  } catch (e) {
    console.error(`⚠️ [${rid}] (service) UsageLog append failed:`, e?.message || e);
  }

  // ===== parse（堅牢）=====
  const raw = getRawTextFromResponsesApi(response);
  console.log(`🧩 [${rid}] (service) raw_len=${String(raw).length}`);

  const parsed = tryParseJson(raw);

  // ここが肝：JSONが壊れても reply_text だけ抜く
  const extracted = extractReplyText(raw);

  const replyText =
    parsed?.reply_text ||
    extracted ||
    (text ? `受信しました：${text}` : "受信しました");

  return {
    replyText,
    ai: parsed || null, // handler の Sheets 保存用（取れたら）
    meta: {
      bot_id,
      userId,
      model: modelUsed,
      resp_id: respId,
      tokens: { inputTokens, outputTokens, totalTokens },
      cost: { usd: costUsd, jpy: costJpy },
      parsed_ok: !!parsed,
      extracted_ok: !!extracted,
    },
  };
}

module.exports = { processMessage };
