"use strict";

const { appendUsageRow } = require("../../sheet/saver");
const { appendVoiceRow } = require("../../repositories/sheetRepository");

async function saveUsage({
  response,
  bot_id,
  rid,
  openaiModel,
  log,
  logError,
}) {
  const usage = response?.data?.usage || {};
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? (inputTokens + outputTokens);

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
        model: response?.data?.model || openaiModel,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        cost_usd: costUsd,
        cost_jpy: costJpy,
        rid,
        resp_id: response?.data?.id || "",
      });
      log(`💰 [${rid}] Usage saved`);
    }
  } catch (e) {
    logError(`⚠️ [${rid}] Usage save failed:`, e?.message || e);
  }
}

async function saveVoiceLog({
  parsed,
  text,
  rid,
  log,
  logError,
}) {
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
      log(`📄 [${rid}] VoiceLog saved`);
    }
  } catch (e) {
    logError(`⚠️ [${rid}] Voice save failed:`, e?.message || e);
  }
}

module.exports = {
  saveUsage,
  saveVoiceLog,
};