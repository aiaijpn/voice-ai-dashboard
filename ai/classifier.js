// ai/classifier.js
const OpenAI = require("openai");
const { appendRow } = require("../sheet/saver");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// gpt-4o-mini 目安（USD / 1M tokens）
const GPT4O_MINI_IN_PER_M = 0.15;
const GPT4O_MINI_OUT_PER_M = 0.60;

function estimateCostUsd_gpt4oMini(inputTokens, outputTokens) {
  return (inputTokens / 1_000_000) * GPT4O_MINI_IN_PER_M
       + (outputTokens / 1_000_000) * GPT4O_MINI_OUT_PER_M;
}

function usdToJpy(usd) {
  const rate = Number(process.env.USDJPY || 150);
  return usd * rate;
}

async function logUsageToSheet({
  botId,
  model,
  inputTokens,
  outputTokens,
  totalTokens,
  costUsd,
  costJpy,
  respId,
}) {
  const ts = new Date().toISOString();
  // UsageLog シートに追記
  await appendRow("UsageLog", [
    ts,
    botId,
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    costUsd,
    costJpy,
    respId,
  ]);
}

/**
 * LINEから来たユーザテキストを OpenAI に投げて、返信文を返す
 * ついでに usage を UsageLog に保存
 */
async function generateReply({ botId, userText }) {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  // ※ Responses API
  const response = await client.responses.create({
    model,
    input: userText,
  });

  // 返信テキスト（環境やモデルで取り方が揺れるので安全に）
  const replyText =
    response.output_text ||
    (response.output?.[0]?.content?.[0]?.text ?? "") ||
    "（返信生成に失敗）";

  // usage
  const usage = response.usage || {};
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? (inputTokens + outputTokens);

  // 推定コスト（まずは gpt-4o-mini 前提でOK）
  const costUsd = estimateCostUsd_gpt4oMini(inputTokens, outputTokens);
  const costJpy = usdToJpy(costUsd);

  // usageログ保存（失敗しても返信は返す）
  try {
    await logUsageToSheet({
      botId,
      model: response.model || model,
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd,
      costJpy,
      respId: response.id || "",
    });
  } catch (e) {
    console.error("UsageLog save failed:", e?.message || e);
  }

  return replyText;
}

module.exports = { generateReply };
