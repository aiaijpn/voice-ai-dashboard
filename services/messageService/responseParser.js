"use strict";

/**
 * responseParser
 *
 * 役割:
 * OpenAIのレスポンスから
 * - raw text
 * - JSON parsed
 * - reply_text
 * を安全に抽出する
 *
 * このファイルは「抽出専用」
 *
 * やらないこと:
 * - category判断
 * - urgency判断
 * - summary判断
 *
 * それらは classifyMessage.js に委譲する
 */

/**
 * OpenAI response から raw text を取得する
 *
 * OpenAI SDK / API の差異に対応するため
 * 複数パターンを順番に試す
 *
 * @param {Object} resp
 * @returns {string}
 */
function getRawText(resp) {
  return (
    resp?.data?.output?.[0]?.content?.[0]?.text || // 新API
    resp?.data?.output_text ||                    // 別形式
    resp?.data?.text ||                           // 旧形式
    ""
  );
}

/**
 * raw text から JSON を安全に parse する
 *
 * OpenAIは余計な文章を混ぜることがあるため
 * - 通常JSON
 * - 文章の中にJSON
 * の両方に対応
 *
 * @param {string} raw
 * @returns {Object|null}
 */
function safeParse(raw) {
  if (!raw) return null;

  try {
    // 正常JSON
    return JSON.parse(raw);
  } catch {
    // JSON部分だけ抽出
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

/**
 * raw text から reply_text を抽出する
 *
 * JSON parse 失敗時のフォールバック
 *
 * @param {string} raw
 * @returns {string}
 */
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

/**
 * OpenAI response を解析する
 *
 * 出力:
 * {
 *   raw,
 *   parsed,
 *   extracted,
 *   replyText
 * }
 *
 * replyText の決定順
 *
 * 1 parsed.reply_text
 * 2 extracted
 * 3 fallback
 *
 * @param {Object} response
 * @param {string} text
 * @param {string} rid
 * @param {Function} log
 */
function parseOpenAIResponse(response, text, rid, log) {

  // raw text
  const raw = getRawText(response);

  // JSON parse
  const parsed = safeParse(raw);

  // fallback reply
  const extracted = extractReply(raw);

  log(
    `🧾 [${rid}] raw head=${String(raw)
      .slice(0, 200)
      .replace(/\n/g, "\\n")}`
  );

  log(`🧾 [${rid}] parsed exists=${parsed ? "YES" : "NO"}`);

  log(
    `🧾 [${rid}] extracted head=${String(extracted)
      .slice(0, 120)
      .replace(/\n/g, "\\n")}`
  );

  /**
   * replyText 決定
   */

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