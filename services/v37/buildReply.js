"use strict";

/**
 * services/v37/buildReply.js
 *
 * 役割:
 * - 返答文を固定テンプレで生成する
 * - topicLabel を統一する（表示名ベース）
 */

function buildClarificationReply() {
  return [
    "どの内容についてのご質問でしょうか？",
    "会社名やテーマをもう少しだけ具体的に教えてください。",
    "【テーマ無し】",
  ].join("\n");
}

function buildWikiMissReply(topicLabel) {
  const lines = ["この内容は未登録です。記録して改善対象にします。"];

  if (topicLabel) {
    lines.push(topicLabel);
  }

  return lines.join("\n");
}

/**
 * companyId → 表示ラベル変換
 * ※ V35と揃える
 */
function getTopicLabelByCompanyId(companyId) {
  const MAP = {
    kanai_suit: "オーダースーツ金井",
    ogata_souzoku: "相続の尾形",
    ikeda_law: "池田法律相談",
    takamura_ai: "AIサービス高村",
    nishikawa_beauty: "美容西川",
  };

  return MAP[companyId] || "";
}

function buildTopicLabel(companyId) {
  if (!companyId) {
    return "【テーマ無し】";
  }

  const label = getTopicLabelByCompanyId(companyId);

  if (!label) {
    return "【テーマ無し】";
  }

  return `【${label}】`;
}

function buildReply({
  replyMode,
  wikiAnswer,
  companyResult,
}) {
  const companyId = companyResult.resolvedCompanyId || null;
  const topicLabel = buildTopicLabel(companyId);

  let replyText = "";

  if (replyMode === "clarification") {
    replyText = buildClarificationReply();
  } else if (replyMode === "wiki_hit") {
    replyText = `${wikiAnswer}\n${topicLabel}`;
  } else {
    replyText = buildWikiMissReply(topicLabel);
  }

  return {
    replyText,
    topicLabel,
    companyId,
    matchedCompanyId: companyId,
    currentCompanyId: companyId,
    isConversationContinuing: Boolean(companyResult.isConversationContinuing),
  };
}

module.exports = {
  buildReply,
};
