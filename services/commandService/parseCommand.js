"use strict";

function normalizeText(text = "") {
  return String(text || "").trim();
}

function stripPrefix(text = "") {
  return String(text || "").replace(/^[＊*]/, "").trim();
}

function hasCommandPrefix(text = "") {
  return String(text || "").startsWith("＊") || String(text || "").startsWith("*");
}

function parseCommand(text = "") {
  const raw = normalizeText(text);

  if (!raw) {
    return null;
  }

  const prefixed = hasCommandPrefix(raw);
  const commandText = prefixed ? stripPrefix(raw) : raw;
  const upper = commandText.toUpperCase();

  if (!commandText) {
    return null;
  }

  if (upper === "V35") {
    return { type: "set_engine", engine: "v35" };
  }

  if (upper === "V37") {
    return { type: "set_engine", engine: "v37" };
  }

  if (upper === "V381" || upper === "V3.81") {
    return { type: "set_engine", engine: "v381" };
  }

  if (upper === "OFF") {
    return { type: "set_engine", engine: "off" };
  }

  if (commandText === "通常") {
    return { type: "set_engine", engine: "v35" };
  }

  if (commandText === "状態") {
    return { type: "show_state" };
  }

  if (prefixed && commandText === "テーマ") {
    return { type: "show_theme" };
  }

  if (prefixed && (commandText === "テーマ一覧" || commandText === "会社一覧")) {
    return { type: "show_theme_list" };
  }

  if (prefixed && (commandText === "エンジン" || commandText === "エンジン一覧")) {
    return { type: "show_engine_list" };
  }

  if (
    prefixed &&
    (commandText === "コマンド" ||
      commandText === "コマンド一覧" ||
      commandText === "ヘルプ")
  ) {
    return { type: "show_command_list" };
  }

  if (prefixed && commandText === "使い方") {
    return { type: "show_usage" };
  }

  if (commandText === "テーマ解除") {
    return { type: "clear_theme" };
  }

  if (prefixed && commandText === "解除") {
    return { type: "request_clear_theme" };
  }

  if (commandText === "解除する") {
    return { type: "clear_theme" };
  }

  if (prefixed && commandText === "固定") {
    return { type: "lock_current_theme" };
  }

  let match = commandText.match(/^固定[\s　]+(.+)$/);
  if (match) {
    return {
      type: "set_theme",
      themeName: match[1].trim(),
    };
  }

  match = commandText.match(/^テーマ固定[\s　]+(.+)$/);
  if (match) {
    return {
      type: "set_theme",
      themeName: match[1].trim(),
    };
  }

  match = commandText.match(/^テーマ[\s　]+(.+)$/);
  if (match) {
    return {
      type: "set_theme",
      themeName: match[1].trim(),
    };
  }

  match = commandText.match(/^(.+?)[でに]固定$/);
  if (match) {
    return {
      type: "set_theme",
      themeName: match[1].trim(),
    };
  }

  return null;
}

module.exports = {
  normalizeText,
  parseCommand,
};
