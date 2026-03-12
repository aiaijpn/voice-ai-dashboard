"use strict";

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
      } catch {
        return null;
      }
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

function parseOpenAIResponse(response, text, rid, log) {
  const raw = getRawText(response);
  const parsed = safeParse(raw);
  const extracted = extractReply(raw);

  log(
    `🧾 [${rid}] raw head=${String(raw).slice(0, 200).replace(/\n/g, "\\n")}`
  );
  log(`🧾 [${rid}] parsed exists=${parsed ? "YES" : "NO"}`);
  log(
    `🧾 [${rid}] extracted head=${String(extracted)
      .slice(0, 120)
      .replace(/\n/g, "\\n")}`
  );

  const replyText =
    parsed?.reply_text ||
    extracted ||
    (text ? `受信しました：${text}` : "受信しました");

  log(
    `💬 [${rid}] replyText=${String(replyText)
      .slice(0, 200)
      .replace(/\n/g, "\\n")}`
  );

  return {
    raw,
    parsed,
    extracted,
    replyText,
  };
}

module.exports = {
  getRawText,
  safeParse,
  extractReply,
  parseOpenAIResponse,
};