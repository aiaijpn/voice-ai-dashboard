"use strict";

const { success, fail } = require("../utils/serviceResponse");
const commandStateRepository = require("../repositories/commandStateRepository");

function buildDefaultState() {
  return {
    currentEngine: "v35",
    currentTheme: "",
    pendingThemeConfirm: null,
  };
}

async function getCommandState({ botId, userId }) {
  if (!botId || !userId) {
    return fail("getCommandState: botId and userId are required");
  }

  const result = await commandStateRepository.getState({ botId, userId });

  if (!result.success) {
    return fail(result.message, result.data || null);
  }

  return success(
    {
      ...buildDefaultState(),
      ...(result.data || {}),
    },
    "command state fetched"
  );
}

async function setCurrentEngine({ botId, userId, engine }) {
  if (!botId || !userId || !engine) {
    return fail("setCurrentEngine: botId, userId, engine are required");
  }

  return commandStateRepository.saveState({
    botId,
    userId,
    patch: {
      currentEngine: String(engine).trim().toLowerCase(),
    },
  });
}

async function setCurrentTheme({ botId, userId, companyId }) {
  if (!botId || !userId) {
    return fail("setCurrentTheme: botId and userId are required");
  }

  return commandStateRepository.saveState({
    botId,
    userId,
    patch: {
      currentTheme: String(companyId || "").trim(),
    },
  });
}

async function setPendingThemeConfirm({ botId, userId, pendingThemeConfirm }) {
  if (!botId || !userId) {
    return fail("setPendingThemeConfirm: botId and userId are required");
  }

  return commandStateRepository.saveState({
    botId,
    userId,
    patch: {
      pendingThemeConfirm: pendingThemeConfirm || null,
    },
  });
}

async function clearPendingThemeConfirm({ botId, userId }) {
  if (!botId || !userId) {
    return fail("clearPendingThemeConfirm: botId and userId are required");
  }

  return commandStateRepository.saveState({
    botId,
    userId,
    patch: {
      pendingThemeConfirm: null,
    },
  });
}

module.exports = {
  buildDefaultState,
  getCommandState,
  setCurrentEngine,
  setCurrentTheme,
  setPendingThemeConfirm,
  clearPendingThemeConfirm,
};
