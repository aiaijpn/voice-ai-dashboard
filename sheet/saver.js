// ファイル: voice-ai-dashboard/sheet/saver.js
"use strict";

/**
 * ADR007 用の Sheets 保存共通部品
 *
 * 役割:
 * - Google Sheets API クライアント生成
 * - 1行 append の共通処理
 *
 * このファイルの責務:
 * - 外部I/O（Google Sheets）だけを担当する
 * - 保存失敗を「失敗」として呼び出し元へ返す
 *
 * このファイルでやらないこと:
 * - 業務ロジック判断
 * - row の意味づけ
 * - userMessage / aiReply の組み立て
 *
 * それらは repository / service 側の責務。
 */

const { google } = require("googleapis");
const { log, error: logError } = require("../utils/logger");

/**
 * 環境変数から Service Account JSON を取得する
 *
 * 必須:
 * - GOOGLE_SERVICE_ACCOUNT_JSON
 *
 * 想定:
 * - Render では環境変数
 * - ローカルでは .env
 *
 * 重要:
 * - JSON は 1行文字列として入っている前提
 * - ここで parse 失敗したら即 throw する
 */
const fs = require("fs");

function getServiceAccountJson() {
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

  if (!file) {
    throw new Error(
      "sheet/saver.getServiceAccountJson: GOOGLE_SERVICE_ACCOUNT_FILE is required"
    );
  }

  try {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `sheet/saver.getServiceAccountJson: invalid JSON file: ${error.message}`
    );
  }
}

/**
 * Google Sheets API client を生成する
 *
 * 重要:
 * - credentials は service account JSON を使う
 * - scope は spreadsheets のみ
 *
 * 将来:
 * - Drive API を使うなら scope 追加を検討
 * - ただし今は広げない
 */
function createSheetsClient() {
  const serviceAccount = getServiceAccountJson();

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({
    version: "v4",
    auth,
  });
}

/**
 * Google Sheets に 1行 append する
 *
 * @param {Object} params
 * @param {string} params.spreadsheetId - 保存先スプレッドシートID
 * @param {string} params.sheetName - 保存先シート名
 * @param {Array}  params.values - 1行分の配列
 *
 * 重要:
 * - values は「1行の配列」を受け取る
 * - API requestBody では [values] にして 2次元配列へ変換する
 *
 * 契約:
 * - 成功時は { success: true, ... } を返す
 * - 失敗時は必ず throw する
 *
 * なぜ throw するか:
 * - 呼び出し元（repository/service）が失敗を正しく扱うため
 * - ここで false を返すだけだと、上位が成功と誤認しやすい
 *
 * ADR007 的にはここが非常に重要。
 */
async function appendRowToSheet({ spreadsheetId, sheetName, values }) {
  const safeSpreadsheetId = String(spreadsheetId || "").trim();
  const safeSheetName = String(sheetName || "").trim();

  // --- 入力契約の防御 ---
  if (!safeSpreadsheetId) {
    throw new Error("sheet/saver.appendRowToSheet: spreadsheetId is required");
  }

  if (!safeSheetName) {
    throw new Error("sheet/saver.appendRowToSheet: sheetName is required");
  }

  if (!Array.isArray(values)) {
    throw new Error("sheet/saver.appendRowToSheet: values must be an array");
  }

  // --- 実行前ログ ---
  // values 全文を出すとログが肥大化するので、ここでは件数中心
  log("sheet/saver.appendRowToSheet start", {
    spreadsheetId: safeSpreadsheetId,
    sheetName: safeSheetName,
    valueCount: values.length,
  });

  try {
    const sheets = createSheetsClient();

    await sheets.spreadsheets.values.append({
      spreadsheetId: safeSpreadsheetId,
      range: `${safeSheetName}!A1:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [values], // 1行 append のため 2次元配列にする
      },
    });

    // --- 成功ログ ---
    log("sheet/saver.appendRowToSheet success", {
      spreadsheetId: safeSpreadsheetId,
      sheetName: safeSheetName,
      valueCount: values.length,
    });

    return {
      success: true,
      message: "sheet/saver.appendRowToSheet: appended",
      data: {
        spreadsheetId: safeSpreadsheetId,
        sheetName: safeSheetName,
      },
    };
  } catch (error) {
    // --- 失敗ログ ---
    // ここでは必ず throw し直す
    logError("sheet/saver.appendRowToSheet failed", {
      message: error.message,
      stack: error.stack,
      spreadsheetId: safeSpreadsheetId,
      sheetName: safeSheetName,
    });

    // 呼び出し元で fail(...) に変換しやすいよう、文脈付きで再 throw
    throw new Error(`sheet/saver.appendRowToSheet failed: ${error.message}`);
  }
}

module.exports = {
  appendRowToSheet,
  getServiceAccountJson,
  createSheetsClient,
};