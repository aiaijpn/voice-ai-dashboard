"use strict";

const { success, fail } = require("../../utils/serviceResponse");
const { parseCommand } = require("./parseCommand");
const {
  getCommandState,
  setCurrentEngine,
  setCurrentTheme,
} = require("../commandStateService");

const THEME_ALIAS_MAP = {
  "金井": "kanai_suit",
  "池田法律": "ikeda_law",
  "池田": "ikeda_law",
};

const THEME_LABEL_MAP = {
  "kanai_suit": "オーダースーツ金井",
  "ikeda_law": "池田法律相談",
};

function getThemeLabel(companyId = "") {
  return THEME_LABEL_MAP[String(companyId || "").trim()] || "なし";
}

function buildStateReply(state = {}) {
  const engine = String(state.currentEngine || "v35").toUpperCase();
  const theme = state.currentTheme ? getThemeLabel(state.currentTheme) : "なし";

  return [
    "現在の状態",
    `・エンジン: ${engine}`,
    `・テーマ固定: ${theme}`,
  ].join("\n");
}

function resolveThemeNameToCompanyId(themeName = "") {
  const key = String(themeName || "").trim();
  return THEME_ALIAS_MAP[key] || "";
}

async function executeCommand({ botId, userId, text }) {
  const command = parseCommand(text);

  if (!command) {
    return success(
      {
        handled: false,
      },
      "not command"
    );
  }

  if (command.type === "set_engine") {
    await setCurrentEngine({
      botId,
      userId,
      engine: command.engine,
    });

    return success(
      {
        handled: true,
        replyText: `${command.engine.toUpperCase()} に切り替えました。`,
      },
      "engine switched"
    );
  }

  if (command.type === "show_state") {
    const stateResult = await getCommandState({ botId, userId });

    if (!stateResult.success) {
      return fail(stateResult.message, stateResult.data || null);
    }

    return success(
      {
        handled: true,
        replyText: buildStateReply(stateResult.data),
      },
      "state shown"
    );
  }

  if (command.type === "clear_theme") {
    await setCurrentTheme({
      botId,
      userId,
      companyId: "",
    });

    return success(
      {
        handled: true,
        replyText: "テーマ固定を解除しました。",
      },
      "theme cleared"
    );
  }

  if (command.type === "set_theme") {
    const companyId = resolveThemeNameToCompanyId(command.themeName);

    if (!companyId) {
      return success(
        {
          handled: true,
          replyText: `テーマ「${command.themeName}」は未登録です。`,
        },
        "theme not found"
      );
    }

    await setCurrentTheme({
      botId,
      userId,
      companyId,
    });

    return success(
      {
        handled: true,
        replyText: `テーマを【${getThemeLabel(companyId)}】に固定しました。`,
      },
      "theme set"
    );
  }

  return success(
    {
      handled: false,
    },
    "not handled"
  );
}

module.exports = {
  executeCommand,
  buildStateReply,
  resolveThemeNameToCompanyId,
};
