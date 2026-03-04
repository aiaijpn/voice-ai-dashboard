// services/messageService.js
"use strict";

const { log, error: logError } = require("../utils/logger");
const axios = require("axios");
const { appendUsageRow } = require("../sheet/saver");
const { appendVoiceRow } = require("../repositories/sheetRepository");
const { getProfile } = require("./operatorProfileService");

// 役割：LINE受信後の「考える処理」を集約
// ・OpenAI呼び出し
// ・Usage保存
// ・本文ログ保存（repository経由）
// 将来：handlerは受信と返信だけにする

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

log("📦 messageService.js loaded:", new Date().toISOString());
log("🔧 ENV CHECK (service)");
log(" - OPENAI_API_KEY:", OPENAI_API_KEY ? "OK" : "MISSING");
log(" - OPENAI_MODEL:", OPENAI_MODEL);

const toneGuideMap = {
  polite: "丁寧で落ち着いた敬語。短く要点のみ。",
  casual: "親しみやすくフランク。馴れ馴れしすぎない。短く。",
  sales: "提案型。メリットを1つ示し、押し売りせず次の一歩を添える。短く。",
  gentle: "やさしく安心感。相手の気持ちを尊重しつつ短く。",
};

function getRawText(resp) {
  return (
    resp?.data?.output?.[0]?.content?.[0]?.text ||
    resp?.data?.output_text ||
    resp?.data?.text ||
    ""
  );
}

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
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
}

function extractReply(raw) {
  if (!raw) return "";
  const m = String(raw).match(/"reply_text"\s*:\s*"([\s\S]*?)"\s*(,|\})/);
  if (!m) return "";
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

  // ★ ここは後で上書きするので let にする（const だと落ちる）
  let systemPrompt = `
出力は必ず指定JSONスキーマに一致させること（余計なキー禁止）。
reply_text は次の口調ルールに従う: ${toneGuide}
summary/category/urgency_score は回答の影響を受けず内容理解に基づいて返す。
`.trim();

  log(`🤖 [${rid}] (service) calling OpenAI...`);

  // ===== Operatorプロフィール取得＆整形 =====
  const op = await getProfile(); // ★ await 必須
  const operatorProfile = String(op?.profile_text || "")
    .replace(/\r/g, "") // CR削除
    .replace(/\\n/g, "\n") // 文字としての \n を改行へ（必要なら）
    .replace(/"/g, "'") // JSON破壊防止（保険）
    .replace(/\t/g, " ") // タブ除去
    .trim();

  log(`🧩 [${rid}] operatorProfile len=${operatorProfile.length}`);
  log(`🧩 [${rid}] operatorProfile head=${operatorProfile.slice(0, 80)}`);

  if (operatorProfile) {
    systemPrompt = `
【最優先】以下のOperatorプロフィールの口調・価値観・判断基準を必ず優先する。矛盾した場合はプロフィールを優先する。

[Operatorプロフィール]
${operatorProfile}

[共通ルール]
${systemPrompt}
`.trim();
  }

  log(
    `🧩 [${rid}] systemPrompt head=${systemPrompt
      .slice(0, 100)
      .replace(/\n/g, "\\n")}`
  );

  // ===== OpenAI 呼び出し =====
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

  log(`✅ [${rid}] (service) OpenAI response received`);

  // ===== Usage保存 =====
  const usage = response.data.usage || {};
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? inputTokens + outputTokens;

  const IN_PER_M = 0.15;
  const OUT_PER_M = 0.60;

  const costUsd =
    (inputTokens / 1_000_000) * IN_PER_M +
    (outputTokens / 1_000_000) * OUT_PER_M;

  const usdJpy = Number(process.env.USDJPY || 150);
  const costJpy = costUsd * usdJpy;

  try {
    if (appendUsageRow) {
      await appendUsageRow({
        ts: new Date().toISOString(),
        bot_id,
        model: response.data.model || OPENAI_MODEL,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        cost_usd: costUsd,
        cost_jpy: costJpy,
        rid,
        resp_id: response.data.id || "",
      });
      log(`💰 [${rid}] (service) Usage saved`);
    }
  } catch (e) {
    // ★ error is not defined を避ける（logError を使う）
    logError(`⚠️ [${rid}] Usage save failed:`, e?.message || e);
  }

  // ===== 応答抽出 =====
  const raw = getRawText(response);
  const parsed = safeParse(raw);
  const extracted = extractReply(raw);

  const replyText =
    parsed?.reply_text ||
    extracted ||
    (text ? `受信しました：${text}` : "受信しました");

  // ===== 本文ログ保存（repository経由）=====
  try {
    if (parsed) {
      await appendVoiceRow({
        timestamp: new Date().toISOString(),
        user_text: text,
        summary: parsed.summary,
        category: parsed.category,
        urgency_score: parsed.urgency_score,
        reply_text: parsed.reply_text,
      });
      log(`📄 [${rid}] (service) VoiceLog saved`);
    }
  } catch (e) {
    logError(`⚠️ [${rid}] Voice save failed:`, e?.message || e);
  }

  return {
    replyText,
    ai: parsed || null,
  };
}

module.exports = { processMessage };