"use strict";

const { setCurrentTheme, clearPendingThemeConfirm } = require("../commandStateService");
const {
  buildThemeSetReply,
  buildThemeRejectReply,
} = require("./buildThemeConfirmReply");

function toSafeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizeForMatch(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[\s　]+/g, "")
    .replace(/[!！?？。、｡,\-\/\/・／]/g, "")
    .replace(/[ーｰ]/g, "");
}

function toHalfWidthNumber(text = "") {
  const normalized = String(text || "").replace(/[０-９]/g, (ch) =>
    String(ch.charCodeAt(0) - 65248)
  );
  const digits = normalized.match(/\d+/);
  return digits ? digits[0] : "";
}

function isYesText(text = "") {
  const safe = normalizeForMatch(text);
  return ["はい", "ハイ", "yes", "y"].some((token) => safe === token);
}

function isNoText(text = "") {
  const safe = normalizeForMatch(text);
  return ["違う", "ちがう", "いいえ", "no"].some((token) => safe === token);
}

function findCandidateByNumber(text = "", candidates = []) {
  const numberText = toHalfWidthNumber(text);
  if (!numberText) {
    return null;
  }

  const index = Number(numberText) - 1;
  if (index < 0 || index >= candidates.length) {
    return null;
  }

  return candidates[index];
}

function matchesCandidateName(input = "", candidate = {}) {
  const normalizedInput = normalizeForMatch(input);
  if (!normalizedInput) {
    return false;
  }

  const candidateNames = [
    candidate.displayName,
    candidate.shortName,
    ...(Array.isArray(candidate.aliases) ? candidate.aliases : []),
  ]
    .filter(Boolean)
    .map((value) => normalizeForMatch(value));

  return candidateNames.some((name) => name === normalizedInput || name.includes(normalizedInput) || normalizedInput.includes(name));
}

function findCandidateByName(input = "", candidates = []) {
  if (!input) {
    return null;
  }

  for (const candidate of candidates) {
    if (matchesCandidateName(input, candidate)) {
      return candidate;
    }
  }

  return null;
}

async function handlePendingThemeConfirm({
  userMessage,
  pendingThemeConfirm,
  botId,
  userId,
} = {}) {
  const safeMessage = toSafeString(userMessage);
  const candidates = Array.isArray(pendingThemeConfirm?.candidates)
    ? pendingThemeConfirm.candidates
    : [];

  if (!safeMessage || candidates.length === 0) {
    return {
      handled: false,
    };
  }

  if (isNoText(safeMessage)) {
    await clearPendingThemeConfirm({ botId, userId });
    return {
      handled: true,
      replyText: buildThemeRejectReply(),
    };
  }

  const selectedByNumber = findCandidateByNumber(safeMessage, candidates);
  if (selectedByNumber) {
    await setCurrentTheme({
      botId,
      userId,
      companyId: selectedByNumber.companyId,
    });
    await clearPendingThemeConfirm({ botId, userId });
    return {
      handled: true,
      replyText: buildThemeSetReply(selectedByNumber),
    };
  }

  const selectedByName = findCandidateByName(safeMessage, candidates);
  if (selectedByName) {
    await setCurrentTheme({
      botId,
      userId,
      companyId: selectedByName.companyId,
    });
    await clearPendingThemeConfirm({ botId, userId });
    return {
      handled: true,
      replyText: buildThemeSetReply(selectedByName),
    };
  }

  if (isYesText(safeMessage) && candidates.length === 1) {
    const selected = candidates[0];
    await setCurrentTheme({
      botId,
      userId,
      companyId: selected.companyId,
    });
    await clearPendingThemeConfirm({ botId, userId });
    return {
      handled: true,
      replyText: buildThemeSetReply(selected),
    };
  }

  return {
    handled: false,
  };
}

module.exports = {
  handlePendingThemeConfirm,
};
