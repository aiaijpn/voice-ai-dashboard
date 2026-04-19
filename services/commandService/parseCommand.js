"use strict";

/**
 * テキストを正規化する
 * 空値をチェックして、前後の空白を除去する
 * @param {string} text - 正規化対象のテキスト
 * @returns {string} 正規化されたテキスト
 */
function normalizeText(text = "") {
  return String(text || "").trim();
}

/**
 * コマンド文字列をパースして、コマンドオブジェクトを返す
 * テーマ設定、エンジン切り替え、状態表示などのコマンドに対応
 * @param {string} text - パース対象のテキスト
 * @returns {object|null} パースされたコマンドオブジェクト、または null
 */
function parseCommand(text = "") {
  const raw = normalizeText(text);
  const upper = raw.toUpperCase();

  // 空文字列の場合はコマンドなしと判定
  if (!raw) {
    return null;
  }

  // エンジン設定: v35エンジンに切り替え
  if (upper === "V35") {
    return { type: "set_engine", engine: "v35" };
  }

  // エンジン設定: v37エンジンに切り替え
  if (upper === "V37") {
    return { type: "set_engine", engine: "v37" };
  }

  // エンジン設定: エンジンをオフにする
  if (upper === "OFF") {
    return { type: "set_engine", engine: "off" };
  }

  // 状態表示コマンド: 現在の状態を表示
  if (raw === "状態") {
    return { type: "show_state" };
  }

  // テーマクリアコマンド: 現在のテーマ設定を解除
  if (raw === "テーマ解除") {
    return { type: "clear_theme" };
  }

  // テーマ設定コマンド: 「テーマ {テーマ名}」または「テーマ　{テーマ名}」の形式でテーマを設定
  if (/^テーマ[\s　]+/.test(raw)) {
    const themeName = raw.replace(/^テーマ[\s　]+/, "").trim();

    // テーマ名が空の場合は無効なコマンド
    if (!themeName) return null;

    return {
      type: "set_theme",
      themeName,
    };
  }

  // 上記のいずれにも該当しない場合はコマンドなしと判定
  return null;
}

/**
 * 公開インターフェース
 * parseCommand関数を外部に提供
 */
module.exports = {
  parseCommand,
};
