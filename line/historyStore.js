// ファイル: voice-ai-dashboard/line/historyStore.js
"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

console.log("📦 historyStore.js loaded:", new Date().toISOString());

/**
 * 保存先（最優先：環境変数）
 * - Render等で場所を変えたい時は HISTORY_JSON_PATH を指定
 * デフォルトはこのファイルと同じフォルダ: /line/history.json
 */
const HISTORY_JSON_PATH =
  process.env.HISTORY_JSON_PATH || path.join(__dirname, "history.json");

// 直近N件（role単位）を返す・保存も肥大化させない
const HISTORY_MAX = Number(process.env.HISTORY_MAX || 10);
// 保存上限（安全のため少し多めに保持）
const HISTORY_KEEP = Number(process.env.HISTORY_KEEP || Math.max(HISTORY_MAX * 4, 40));

console.log("🧠 historyStore config");
console.log(" - HISTORY_JSON_PATH:", HISTORY_JSON_PATH);
console.log(" - HISTORY_MAX:", HISTORY_MAX);
console.log(" - HISTORY_KEEP:", HISTORY_KEEP);

/**
 * プロセス内ロック（同時書き込み事故を防ぐ）
 * ※Renderの1インスタンス運用ならこれで十分。将来マルチインスタンスならDBへ。
 */
let writeQueue = Promise.resolve();

async function ensureFile() {
  try {
    await fsp.access(HISTORY_JSON_PATH, fs.constants.F_OK);
    return;
  } catch (_) {
    // 親ディレクトリが無いケースは作る
    const dir = path.dirname(HISTORY_JSON_PATH);
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(HISTORY_JSON_PATH, "{}", "utf8");
    console.log("🧠 history.json created:", HISTORY_JSON_PATH);
  }
}

async function readAll() {
  await ensureFile();
  const raw = await fsp.readFile(HISTORY_JSON_PATH, "utf8");
  if (!raw || !raw.trim()) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch (e) {
    console.log("💥 history.json parse error -> backup & reset:", e.message || e);
    // 壊れてたら退避してリセット
    const backupPath = `${HISTORY_JSON_PATH}.broken.${Date.now()}`;
    await fsp.writeFile(backupPath, raw, "utf8");
    await fsp.writeFile(HISTORY_JSON_PATH, "{}", "utf8");
    return {};
  }
}

async function writeAll(obj) {
  await ensureFile();
  const json = JSON.stringify(obj, null, 2);
  await fsp.writeFile(HISTORY_JSON_PATH, json, "utf8");
}

function normalizeMessage(msg) {
  const role = msg?.role === "assistant" ? "assistant" : "user";
  const content = String(msg?.content || "").trim();
  const ts = Number(msg?.ts || Date.now());
  return { role, content, ts };
}

/**
 * 直近の会話履歴を返す（role単位）
 * @param {string} key 例: `${bot_id}:${userId}`
 * @returns {Promise<Array<{role:string, content:string, ts:number}>>}
 */
async function getHistory(key) {
  const data = await readAll();
  const arr = Array.isArray(data[key]) ? data[key] : [];
  // 返すのは直近N件
  return arr.slice(-HISTORY_MAX);
}

/**
 * 会話メッセージを追加保存する
 * @param {string} key
 * @param {{role:"user"|"assistant", content:string, ts?:number}} msg
 */
async function appendMessage(key, msg) {
  // 直列化して書き込み衝突を避ける
  writeQueue = writeQueue.then(async () => {
    const data = await readAll();
    const arr = Array.isArray(data[key]) ? data[key] : [];

    const m = normalizeMessage(msg);

    // 空contentは保存しない（ゴミ増やさない）
    if (!m.content) return;

    arr.push(m);

    // 肥大化防止：保存はKEEPまで
    const trimmed = arr.slice(-HISTORY_KEEP);
    data[key] = trimmed;

    await writeAll(data);
  });

  return writeQueue;
}

module.exports = {
  getHistory,
  appendMessage,
  HISTORY_JSON_PATH,
};
