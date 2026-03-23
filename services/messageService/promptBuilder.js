"use strict";

const { getProfile } = require("../operatorProfileService");

const toneGuideMap = {
  polite: "丁寧で落ち着いた敬語。短く要点のみ。",
  casual: "親しみやすくフランク。馴れ馴れしすぎない。短く。",
  sales: "提案型。メリットを1つ示し、押し売りせず次の一歩を添える。短く。",
  gentle: "やさしく安心感。相手の気持ちを尊重しつつ短く。",
};

/**
 * 企業候補ヒント文を作る
 *
 * 方針:
 * - 候補が無ければ空文字
 * - V3では最大2件まで
 * - AIには「必要時のみ自然に触れる」とだけ伝える
 * - URLはここでは渡さない（会話本文が不自然に長くなるのを防ぐ）
 *
 * @param {Array} companyCandidates
 * @returns {string}
 */
function buildCompanyHint(companyCandidates = []) {
  if (!Array.isArray(companyCandidates) || companyCandidates.length === 0) {
    return "";
  }

  const lines = companyCandidates
    .slice(0, 2)
    .map((company, index) => {
      const displayName = String(company?.display_name || "").trim();
      const category = String(company?.category || "").trim();
      const shortPitch = String(company?.short_pitch || "").trim();

      return `${index + 1}. ${displayName} / ${category} / ${shortPitch}`;
    })
    .filter(Boolean);

  if (lines.length === 0) {
    return "";
  }

  return `
[関連候補企業]
以下は参考候補です。
会話内容に自然に合う場合のみ、押し売りせず軽く触れてください。
企業紹介を主目的にせず、会話の自然さを優先してください。
無関係なら触れないでください。

${lines.join("\n")}
`.trim();
}

/**
 * system prompt を構築する
 *
 * @param {Object} input
 * @param {string} input.tone
 * @param {string} input.rid
 * @param {Function} input.log
 * @param {Array} input.companyCandidates
 * @returns {Promise<string>}
 */
async function buildSystemPrompt({
  tone = "polite",
  rid = "no_rid",
  log = console.log,
  companyCandidates = [],
}) {
  const toneGuide = toneGuideMap[String(tone)] || toneGuideMap.polite;
  const companyHint = buildCompanyHint(companyCandidates);

  let systemPrompt = `
出力は必ず指定JSONスキーマに一致させること（余計なキー禁止）。
reply_text は次の口調ルールに従う: ${toneGuide}
summary/category/urgency_score は回答の影響を受けず内容理解に基づいて返す。
reply_text は短めで、相手が返しやすい自然な文にする。
質問は多くても1つまでに抑える。
AI感を出しすぎない。
`.trim();

  if (companyHint) {
    systemPrompt = `
${systemPrompt}

${companyHint}
`.trim();
  }

  const op = await getProfile();
  const operatorProfile = String(op?.profile_text || "")
    .replace(/\r/g, "")
    .replace(/\\n/g, "\n")
    .replace(/"/g, "'")
    .replace(/\t/g, " ")
    .trim();

  log(`🧩 [${rid}] operatorProfile len=${operatorProfile.length}`);
  log(`🧩 [${rid}] operatorProfile head=${operatorProfile.slice(0, 80)}`);
  log(`🧩 [${rid}] companyCandidates count=${companyCandidates.length}`);

  if (companyHint) {
    log(
      `🧩 [${rid}] companyHint head=${companyHint
        .slice(0, 120)
        .replace(/\n/g, "\\n")}`
    );
  }

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
 * @param {Array} input.companyCandidates
 * @returns {Promise<{systemPrompt: string, messages: Array}>}
 */
async function buildPromptContext(input = {}) {
  const rid = String(input.rid || "no_rid");
  const tone = String(input.tone || "polite");
  const historyItems = Array.isArray(input.historyItems) ? input.historyItems : [];
  const userText = String(input.userText || "");
  const log = typeof input.log === "function" ? input.log : console.log;
  const companyCandidates = Array.isArray(input.companyCandidates)
    ? input.companyCandidates
    : [];

  const systemPrompt = await buildSystemPrompt({
    rid,
    tone,
    log,
    companyCandidates,
  });

  const messages = buildOpenAIMessages({
    systemPrompt,
    historyItems,
    userText,
  });

  log(`🧩 [${rid}] OpenAI messages built`);
  log(`🧩 [${rid}] historyCount=${historyItems.length}`);
  log(`🧩 [${rid}] messageCount=${messages.length}`);
  log(`🧩 [${rid}] companyCandidatesCount=${companyCandidates.length}`);
  log(
    `🧩 [${rid}] lastUserText=${userText.slice(0, 80).replace(/\n/g, "\\n")}`
  );

  return {
    systemPrompt,
    messages,
  };
}

module.exports = {
  buildCompanyHint,
  buildSystemPrompt,
  mapHistoryItemToOpenAIMessages,
  buildHistoryMessages,
  buildOpenAIMessages,
  buildPromptContext,
};