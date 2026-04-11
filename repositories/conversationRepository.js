"use strict";

/**
 * Conversation History Repository
 *
 * 役割:
 * - 会話履歴1件を Google Sheets に保存する
 * - conversation_history から botId + userId 条件で履歴取得する
 *
 * このファイルの責務:
 * - 会話履歴データを Sheets 用の列順に並べる
 * - 保存先シート名を固定する
 * - Google Sheets から履歴を取得する
 * - saver / Sheets API の成功失敗を serviceResponse 契約で返す
 *
 * このファイルでやらないこと:
 * - 入力値の業務判断
 * - 必須項目の本格検証
 * - userMessage / aiReply の生成
 * - unresolvedQ の判定
 * - OpenAI messages 形式への変換
 *
 * それらは service 層の責務。
 */

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const { appendRowToSheet } = require("../sheet/saver");
const { success, fail } = require("../utils/serviceResponse");

/**
 * 保存先スプレッドシートID
 *
 * ADR-007 の保存契約に従い、
 * spreadsheetId は環境変数から受け取る。
 */
const SPREADSHEET_ID = String(process.env.SPREADSHEET_ID || "").trim();

/**
 * ADR-008 で定義した保存先シート名
 */
const CONVERSATION_SHEET_NAME = "conversation_history";

/**
 * 会話履歴オブジェクトを
 * Google Sheets に append するための「1行配列」に変換する。
 *
 * 列順は V3.4 で以下に固定:
 * 1. timestamp
 * 2. bot_id
 * 3. user_id
 * 4. user_message
 * 5. ai_reply
 * 6. operator_memo
 * 7. manual_send
 * 8. source_type
 * 9. unresolved_q
 * 10. company_id
 *
 * @param {Object} input
 * @returns {Array}
 */
function buildConversationRow(input = {}) {
  return [
    input.timestamp || "",
    input.botId || "",
    input.userId || "",
    input.userMessage || "",
    input.aiReply || "",
    input.operatorMemo || "",
    typeof input.manualSend === "boolean" ? input.manualSend : false,
    input.sourceType || "user_message",
    typeof input.unresolvedQ === "boolean" ? input.unresolvedQ : false,
    input.companyId || "",
  ];
}

/**
 * Google Sheets 読み取り用 client を作る
 *
 * 対応:
 * - GOOGLE_SERVICE_ACCOUNT_JSON
 * - GOOGLE_SERVICE_ACCOUNT_FILE
 *
 * @returns {import("googleapis").sheets_v4.Sheets}
 */
function createSheetsClient() {
  const rawJson = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();
  const filePath = String(process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "").trim();

  let credentials = null;

  if (rawJson) {
    try {
      credentials = JSON.parse(rawJson);
    } catch (error) {
      throw new Error(
        `conversationRepository.createSheetsClient: invalid GOOGLE_SERVICE_ACCOUNT_JSON: ${error.message}`
      );
    }
  } else if (filePath) {
    const resolvedPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(
        `conversationRepository.createSheetsClient: service account file not found: ${resolvedPath}`
      );
    }

    try {
      const fileRaw = fs.readFileSync(resolvedPath, "utf8");
      credentials = JSON.parse(fileRaw);
    } catch (error) {
      throw new Error(
        `conversationRepository.createSheetsClient: invalid GOOGLE_SERVICE_ACCOUNT_FILE: ${error.message}`
      );
    }
  } else {
    throw new Error(
      "conversationRepository.createSheetsClient: GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE is required"
    );
  }

  if (credentials && credentials.private_key) {
    credentials.private_key = String(credentials.private_key).replace(/\\n/g, "\n");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({
    version: "v4",
    auth,
  });
}

/**
 * Sheets の1行配列を repository 用オブジェクトへ変換する
 *
 * 列順:
 * 0: timestamp
 * 1: bot_id
 * 2: user_id
 * 3: user_message
 * 4: ai_reply
 * 5: operator_memo
 * 6: manual_send
 * 7: source_type
 * 8: unresolved_q
 * 9: company_id
 *
 * @param {Array} row
 * @returns {Object}
 */
function mapRowToConversation(row = []) {
  return {
    timestamp: row[0] || "",
    botId: row[1] || "",
    userId: row[2] || "",
    userMessage: row[3] || "",
    aiReply: row[4] || "",
    operatorMemo: row[5] || "",
    manualSend: parseSheetBoolean(row[6]),
    sourceType: row[7] || "",
    unresolvedQ: parseSheetBoolean(row[8]),
    companyId: row[9] || "",
  };
}

/**
 * Sheets の値は文字列化されることがあるため、
 * boolean として安全に読む。
 *
 * @param {any} value
 * @returns {boolean}
 */
function parseSheetBoolean(value) {
  if (value === true || value === "true" || value === "TRUE") {
    return true;
  }
  return false;
}

/**
 * 会話履歴を conversation_history シートへ 1行 append する
 *
 * @param {Object} input
 * @returns {Promise<{success:boolean,message:string,data:any}>}
 */
async function appendConversationRow(input = {}) {
  try {
    if (!SPREADSHEET_ID) {
      return fail(
        "conversationRepository.appendConversationRow: SPREADSHEET_ID is required"
      );
    }

    const values = buildConversationRow(input);

    const result = await appendRowToSheet({
      spreadsheetId: SPREADSHEET_ID,
      sheetName: CONVERSATION_SHEET_NAME,
      values,
    });

    return success(
      {
        sheetName: CONVERSATION_SHEET_NAME,
        values,
        sheetResult: result.data || null,
      },
      "conversationRepository.appendConversationRow: row appended"
    );
  } catch (error) {
    return fail(
      `conversationRepository.appendConversationRow: ${error.message}`
    );
  }
}

/**
 * conversation_history から
 * botId + userId 条件で直近履歴を取得する
 *
 * 取得方針:
 * - Sheets 全体を読み込む
 * - ヘッダ行を除外する
 * - botId + userId で絞る
 * - 新しい順で limit 件に絞る
 * - 返却時は OpenAI に渡しやすいよう古い→新しい順に並べる
 *
 * @param {Object} input
 * @param {string} input.botId
 * @param {string} input.userId
 * @param {number} [input.limit=6]
 * @returns {Promise<{success:boolean,message:string,data:any}>}
 */
async function getConversationHistory(input = {}) {
  try {
    if (!SPREADSHEET_ID) {
      return fail(
        "conversationRepository.getConversationHistory: SPREADSHEET_ID is required"
      );
    }

    const botId = String(input.botId || "").trim();
    const userId = String(input.userId || "").trim();
    const limit = Number(input.limit || 6);

    if (!botId) {
      return fail(
        "conversationRepository.getConversationHistory: botId is required"
      );
    }

    if (!userId) {
      return fail(
        "conversationRepository.getConversationHistory: userId is required"
      );
    }

    const sheets = createSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CONVERSATION_SHEET_NAME}!A:J`,
    });

    const rows = Array.isArray(response.data.values) ? response.data.values : [];

    if (rows.length === 0) {
      return success(
        {
          sheetName: CONVERSATION_SHEET_NAME,
          items: [],
          total: 0,
        },
        "conversationRepository.getConversationHistory: no rows"
      );
    }

    // 1行目はヘッダ前提
    const bodyRows = rows.slice(1);

    const matched = bodyRows
      .map(mapRowToConversation)
      .filter((item) => item.botId === botId && item.userId === userId);

    const latestLimited = matched.slice(-limit);
    const items = latestLimited;

    return success(
      {
        sheetName: CONVERSATION_SHEET_NAME,
        items,
        total: items.length,
      },
      "conversationRepository.getConversationHistory: history fetched"
    );
  } catch (error) {
    return fail(
      `conversationRepository.getConversationHistory: ${error.message}`
    );
  }
}

module.exports = {
  CONVERSATION_SHEET_NAME,
  buildConversationRow,
  createSheetsClient,
  mapRowToConversation,
  appendConversationRow,
  getConversationHistory,
};