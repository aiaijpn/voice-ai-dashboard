"use strict";

const { getProfile } = require("../operatorProfileService");

const toneGuideMap = {
  polite: "丁寧で落ち着いた敬語。短く要点のみ。",
  casual: "親しみやすくフランク。馴れ馴れしすぎない。短く。",
  sales: "提案型。メリットを1つ示し、押し売りせず次の一歩を添える。短く。",
  gentle: "やさしく安心感。相手の気持ちを尊重しつつ短く。",
};

/**
 * system prompt を構築する
 *
 * @param {Object} input
 * @param {string} input.tone
 * @param {string} input.rid
 * @param {Function} input.log
 * @returns {Promise<string>}
 */
async function buildSystemPrompt({ tone = "polite", rid = "no_rid", log = console.log }) {
  const toneGuide = toneGuideMap[String(tone)] || toneGuideMap.polite;

  let systemPrompt = `
出力は必ず指定JSONスキーマに一致させること（余計なキー禁止）。
reply_text は次の口調ルールに従う: ${toneGuide}
summary/category/urgency_score は回答の影響を受けず内容理解に基づいて返す。
`.trim();

  const op = await getProfile();
  const operatorProfile = String(op?.profile_text || "")
    .replace(/\r/g, "")
    .replace(/\\n/g, "\n")
    .replace(/"/g, "'")
    .replace(/\t/g, " ")
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

  return systemPrompt;
}

/**
 * repository/service から返ってきた履歴1件を
 * OpenAI messages 形式へ変換する
 *
 * ルール:
 * - user_message → user
 * - ai_reply → assistant
 * - admin_message → 除外
 * - 空文字は除外
 *
 * @param {Object} item
 * @returns {Object|null}
 */
function mapHistoryItemToOpenAIMessages(item = {}) {
  const sourceType = String(item.sourceType || "").trim();

  if (sourceType === "user_message") {
    const content = String(item.userMessage || "").trim();
    if (!content) {
      return null;
    }

    return {
      role: "user",
      content,
    };
  }

  if (sourceType === "ai_reply") {
    const content = String(item.aiReply || "").trim();
    if (!content) {
      return null;
    }

    return {
      role: "assistant",
      content,
    };
  }

  /**
   * ADR-011 / ADR-015 方針:
   * admin_message は OpenAI messages に入れない
   */
  return null;
}

/**
 * 会話履歴配列を OpenAI messages 配列へ変換する
 *
 * @param {Array} items
 * @returns {Array}
 */
function buildHistoryMessages(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map(mapHistoryItemToOpenAIMessages).filter(Boolean);
}

/**
 * OpenAI へ渡す messages を構築する
 *
 * 順番:
 * 1. system
 * 2. history (古い→新しい)
 * 3. current user
 *
 * @param {Object} input
 * @param {string} input.systemPrompt
 * @param {Array} input.historyItems
 * @param {string} input.userText
 * @returns {Array}
 */
function buildOpenAIMessages(input = {}) {
  const systemPrompt = String(input.systemPrompt || "").trim();
  const userText = String(input.userText || "").trim();
  const historyItems = Array.isArray(input.historyItems)
    ? input.historyItems
    : [];

  const messages = [];

  if (systemPrompt) {
    messages.push({
      role: "system",
      content: systemPrompt,
    });
  }

  const historyMessages = buildHistoryMessages(historyItems);
  messages.push(...historyMessages);

  if (userText) {
    messages.push({
      role: "user",
      content: userText,
    });
  }

  return messages;
}

/**
 * ADR-016:
 * AI入力構築責務を promptBuilder に集約する
 *
 * 役割:
 * 1. systemPrompt生成
 * 2. 履歴統合
 * 3. OpenAI messages生成
 * 4. AI入力ログ出力
 *
 * @param {Object} input
 * @param {string} input.rid
 * @param {string} input.tone
 * @param {Array} input.historyItems
 * @param {string} input.userText
 * @param {Function} input.log
 * @returns {Promise<{systemPrompt: string, messages: Array}>}
 */
async function buildPromptContext(input = {}) {
  const rid = String(input.rid || "no_rid");
  const tone = String(input.tone || "polite");
  const historyItems = Array.isArray(input.historyItems) ? input.historyItems : [];
  const userText = String(input.userText || "");
  const log = typeof input.log === "function" ? input.log : console.log;

  const systemPrompt = await buildSystemPrompt({
    rid,
    tone,
    log,
  });

  const messages = buildOpenAIMessages({
    systemPrompt,
    historyItems,
    userText,
  });

  log(`🧩 [${rid}] OpenAI messages built`);
  log(`🧩 [${rid}] historyCount=${historyItems.length}`);
  log(`🧩 [${rid}] messageCount=${messages.length}`);
  log(
    `🧩 [${rid}] lastUserText=${userText.slice(0, 80).replace(/\n/g, "\\n")}`
  );

  return {
    systemPrompt,
    messages,
  };
}

module.exports = {
  buildSystemPrompt,
  mapHistoryItemToOpenAIMessages,
  buildHistoryMessages,
  buildOpenAIMessages,
  buildPromptContext,
};