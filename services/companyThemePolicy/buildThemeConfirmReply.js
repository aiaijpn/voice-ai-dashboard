"use strict";

function buildDisplayName(candidate = {}) {
  return String(candidate.displayName || candidate.shortName || "").trim();
}

function buildSingleCandidateConfirmReply(candidate = {}) {
  const displayName = buildDisplayName(candidate);
  return [
    `お望みは【${displayName}】ですか？`,
    `よろしければ「はい」と送ってください。`,
    `違う場合は、知りたい内容をもう少し教えてください。`,
  ].join("\n");
}

function buildMultiCandidateConfirmReply(candidates = []) {
  const lines = ["関連しそうな候補があります。", ""]; 

  candidates.slice(0, 3).forEach((candidate, index) => {
    lines.push(`${index + 1}. ${buildDisplayName(candidate)}`);
  });

  lines.push("", "どちらについて知りたいですか？", "番号か会社名で送ってください。");

  return lines.join("\n");
}

function buildThemeSetReply(candidate = {}) {
  const displayName = buildDisplayName(candidate);
  return `テーマを【${displayName}】に固定しました。\n続けてご質問ください。`;
}

function buildThemeRejectReply() {
  return [
    "承知しました。",
    "どの内容について知りたいですか？",
  ].join("\n");
}

function buildThemeConfirmReply(candidates = []) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return buildThemeRejectReply();
  }

  if (candidates.length === 1) {
    return buildSingleCandidateConfirmReply(candidates[0]);
  }

  return buildMultiCandidateConfirmReply(candidates);
}

module.exports = {
  buildSingleCandidateConfirmReply,
  buildMultiCandidateConfirmReply,
  buildThemeConfirmReply,
  buildThemeSetReply,
  buildThemeRejectReply,
};
