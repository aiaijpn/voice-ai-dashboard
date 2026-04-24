"use strict";

const { success, fail } = require("../../utils/serviceResponse");
const { parseCommand } = require("./parseCommand");
const {
  normalizeCompanyId,
} = require("../company/companyIdNormalizer");
const {
  getCommandState,
  setCurrentEngine,
  setCurrentTheme,
} = require("../commandStateService");

const THEME_ALIAS_MAP = {
  "金井": "kanai_suit",
  "スーツ金井": "kanai_suit",
  "オーダースーツ金井": "kanai_suit",
  "池田": "ikeda_law",
  "池田法律": "ikeda_law",
  "池田法律相談": "ikeda_law",
};

const THEME_LABEL_MAP = {
  kanai_suit: "オーダースーツ金井",
  ikeda_law: "池田法律相談",
};

function getThemeLabel(companyId = "") {
  return THEME_LABEL_MAP[String(companyId || "").trim()] || "なし";
}

function buildStateReply(state = {}) {
  const engine = String(state.currentEngine || "v35").toUpperCase();
  const theme = state.currentTheme ? getThemeLabel(state.currentTheme) : "なし";

  return [
    "【現在の状態】",
    `・エンジン: ${engine}`,
    `・テーマ固定: ${theme}`,
  ].join("\n");
}

function buildCommandListReply() {
  return [
    "【コマンド一覧】",
    "",
    "■ 基本",
    "・＊コマンド：この一覧を表示",
    "・＊使い方：使い方を表示",
    "・＊状態：現在の設定を表示",
    "・＊テーマ：現在の固定テーマを表示",
    "",
    "■ エンジン",
    "・＊エンジン：エンジン一覧",
    "・＊V37：安全ガード型エンジン",
    "・＊V381：テーマ固定wiki判定エンジン",
    "・＊通常：通常会話へ戻す",
    "",
    "■ テーマ固定",
    "・＊テーマ一覧：固定可能テーマ一覧",
    "・＊固定 金井：金井に固定",
    "・＊固定 池田：池田法律に固定",
    "・＊解除：テーマ固定解除の確認",
    "・＊解除する：テーマ固定を解除",
    "",
    "まずは「＊状態」で現在設定を確認できます。",
  ].join("\n");
}

function buildUsageReply() {
  return [
    "【使い方】",
    "",
    "通常の会話はそのまま送ってください。",
    "",
    "コマンドを使うときは、先頭に ＊ を付けます。",
    "",
    "例：",
    "・＊状態",
    "・＊テーマ一覧",
    "・＊固定 金井",
    "・＊解除",
    "",
    "現在のおすすめ手順：",
    "1. ＊V381",
    "2. ＊固定 金井",
    "3. 質問する",
    "4. ＊状態 で確認する",
  ].join("\n");
}

function buildThemeListReply() {
  return [
    "【固定可能テーマ一覧】",
    "",
    "・金井：オーダースーツ金井",
    "・池田：池田法律相談",
    "",
    "例：",
    "＊固定 金井",
    "＊固定 池田",
  ].join("\n");
}

function buildEngineListReply() {
  return [
    "【エンジン一覧】",
    "",
    "・＊V37：安全ガード型エンジン",
    "・＊V381：テーマ固定wiki判定エンジン",
    "・＊通常：通常会話へ戻す",
    "・＊OFF：AI応答停止",
    "",
    "現在の状態は「＊状態」で確認できます。",
  ].join("\n");
}

function buildShowThemeReply(state = {}) {
  const theme = state.currentTheme ? getThemeLabel(state.currentTheme) : "なし";
  return `現在のテーマ固定：${theme}`;
}

function resolveThemeNameToCompanyId(themeName = "") {
  const key = String(themeName || "").trim();
  return normalizeCompanyId(THEME_ALIAS_MAP[key] || "");
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

  if (command.type === "show_command_list") {
    return success(
      {
        handled: true,
        replyText: buildCommandListReply(),
      },
      "command list shown"
    );
  }

  if (command.type === "show_usage") {
    return success(
      {
        handled: true,
        replyText: buildUsageReply(),
      },
      "usage shown"
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

  if (command.type === "show_theme") {
    const stateResult = await getCommandState({ botId, userId });

    if (!stateResult.success) {
      return fail(stateResult.message, stateResult.data || null);
    }

    return success(
      {
        handled: true,
        replyText: buildShowThemeReply(stateResult.data),
      },
      "theme shown"
    );
  }

  if (command.type === "show_theme_list") {
    return success(
      {
        handled: true,
        replyText: buildThemeListReply(),
      },
      "theme list shown"
    );
  }

  if (command.type === "show_engine_list") {
    return success(
      {
        handled: true,
        replyText: buildEngineListReply(),
      },
      "engine list shown"
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

  if (command.type === "request_clear_theme") {
    return success(
      {
        handled: true,
        replyText: [
          "テーマ固定を解除しますか？",
          "解除する場合は「＊解除する」と入力してください。",
        ].join("\n"),
      },
      "clear theme requested"
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

  if (command.type === "lock_current_theme") {
    return success(
      {
        handled: true,
        replyText: [
          "現在テーマの自動固定は未実装です。",
          "固定する場合は、次のように入力してください。",
          "",
          "例：",
          "＊固定 金井",
          "＊固定 池田",
        ].join("\n"),
      },
      "lock current theme not implemented"
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
        replyText: `テーマを「${getThemeLabel(companyId)}」に固定しました。`,
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
