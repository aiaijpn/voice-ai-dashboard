"use strict";

const { success, fail } = require("../utils/serviceResponse");

const stateStore = new Map();

function buildKey({ botId, userId }) {
  return `${String(botId || "").trim()}::${String(userId || "").trim()}`;
}

async function getState({ botId, userId }) {
  const key = buildKey({ botId, userId });

  if (!key || key === "::") {
    return fail("getState: invalid key");
  }

  const found = stateStore.get(key) || null;

  return success(found || {}, "state fetched");
}

async function saveState({ botId, userId, patch = {} }) {
  const key = buildKey({ botId, userId });

  if (!key || key === "::") {
    return fail("saveState: invalid key");
  }

  const prev = stateStore.get(key) || {};
  const next = {
    ...prev,
    ...patch,
  };

  stateStore.set(key, next);

  return success(next, "state saved");
}

module.exports = {
  getState,
  saveState,
};
