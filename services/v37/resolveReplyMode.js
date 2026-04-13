"use strict";

/**
 * services/v37/resolveReplyMode.js
 *
 * 役割:
 * - clarification
 * - wiki_hit
 * - wiki_miss
 * のどれかを返す
 */

function resolveReplyMode({
  resolvedCompanyId,
  needsClarification,
  wikiAnswer,
}) {
  if (needsClarification || !resolvedCompanyId) {
    return "clarification";
  }

  if (wikiAnswer) {
    return "wiki_hit";
  }

  return "wiki_miss";
}

module.exports = {
  resolveReplyMode,
};