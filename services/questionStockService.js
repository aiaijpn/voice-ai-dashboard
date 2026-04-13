"use strict";

/**
 * questionStockService
 *
 * 役割:
 * - 未回答の質問を question_stock シートへ保存する
 * - 同一質問が既にある場合は append せず、asked_count / last_asked_at を更新する
 *
 * V3.3 方針:
 * - 判定キーは company_id + normalized_question
 * - 一致あり   -> update
 * - 一致なし   -> append
 *
 * 返り値契約:
 * {
 *   success: boolean,
 *   message: string,
 *   data: object | null
 * }
 */

const { google } = require("googleapis");

const SPREADSHEET_ID = String(process.env.SPREADSHEET_ID || "").trim();
const SHEET_NAME = "question_stock";

/**
 * Sheets client を作成
 */
function createSheetsClient() {
  const fs = require("fs");
  const path = require("path");

  const rawJson = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();
  const filePath = String(process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "").trim();

  let credentials = null;

  if (rawJson) {
    credentials = JSON.parse(rawJson);
  } else if (filePath) {
    const resolvedPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Service account file not found: ${resolvedPath}`);
    }

    credentials = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  } else {
    throw new Error("Google service account credentials are missing");
  }

  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

/**
 * 安全に文字列化
 */
function toSafeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * row 配列を object 化
 * question_stock の列構成:
 * A: timestamp
 * B: user_id
 * C: bot_id
 * D: question
 * E: normalized_question
 * F: company_id
 * G: user_question
 * H: asked_count
 * I: first_asked_at
 * J: last_asked_at
 * K: stock_status
 * L: wiki_answer
 * M: review_note
 * N: question_category
 * O: group_key
 * P: canonical_question
 * Q: draft_answer
 * R: draft_answer_source
 * S: adopted_at
 */
function mapRowToStockObject(row = [], sheetRowNumber = 0) {
  return {
    sheetRowNumber,
    timestamp: row[0] || "",
    user_id: row[1] || "",
    bot_id: row[2] || "",
    question: row[3] || "",
    normalized_question: row[4] || "",
    company_id: row[5] || "",
    user_question: row[6] || "",
    asked_count: Number(row[7] || 0),
    first_asked_at: row[8] || "",
    last_asked_at: row[9] || "",
    stock_status: row[10] || "",
    wiki_answer: row[11] || "",
    review_note: row[12] || "",
    question_category: row[13] || "",
    group_key: row[14] || "",
    canonical_question: row[15] || "",
    draft_answer: row[16] || "",
    draft_answer_source: row[17] || "",
    adopted_at: row[18] || "",
  };
}

/**
 * question_stock 全件取得
 * - 1行目はヘッダ想定
 */
async function getAllQuestionStockRows(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:S`,
  });

  const rows = res.data.values || [];

  if (rows.length <= 1) {
    return [];
  }

  const dataRows = rows.slice(1);

  return dataRows.map((row, index) => {
    const sheetRowNumber = index + 2;
    return mapRowToStockObject(row, sheetRowNumber);
  });
}

/**
 * 既存一致レコードを検索
 * V3.3:
 * - company_id + normalized_question の完全一致
 */
function findExistingStockRow(stockRows, companyId, normalizedQuestion) {
  const targetCompanyId = toSafeString(companyId);
  const targetNormalizedQuestion = toSafeString(normalizedQuestion);

  if (!targetNormalizedQuestion) {
    return null;
  }

  return (
    stockRows.find((row) => {
      return (
        toSafeString(row.company_id) === targetCompanyId &&
        toSafeString(row.normalized_question) === targetNormalizedQuestion
      );
    }) || null
  );
}

/**
 * 既存行の asked_count / last_asked_at を更新
 */
async function updateExistingStockRow(sheets, existingRow, now) {
  const nextAskedCount = Number(existingRow.asked_count || 0) + 1;
  const firstAskedAt = existingRow.first_asked_at || now;
  const lastAskedAt = now;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!H${existingRow.sheetRowNumber}:J${existingRow.sheetRowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[nextAskedCount, firstAskedAt, lastAskedAt]],
    },
  });

  return {
    asked_count: nextAskedCount,
    first_asked_at: firstAskedAt,
    last_asked_at: lastAskedAt,
    sheetRowNumber: existingRow.sheetRowNumber,
  };
}

/**
 * 新規行 append
 */
async function appendNewStockRow(sheets, payload, now) {
  const row = [
    now,
    payload.user_id,
    payload.bot_id,
    payload.question,
    payload.normalized_question,
    payload.company_id,
    payload.user_question,
    1,
    now,
    now,
    "new",
    payload.wiki_answer,
    payload.review_note,
    payload.question_category,
    payload.group_key,
    payload.canonical_question,
    payload.draft_answer,
    payload.draft_answer_source,
    payload.adopted_at,
  ];

  console.log("[questionStockService] APPEND ROW", row);

  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:S`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row],
    },
  });

  console.log("[questionStockService] APPEND RESPONSE", {
    updatedRange: appendRes?.data?.updates?.updatedRange,
    updatedRows: appendRes?.data?.updates?.updatedRows,
    updatedColumns: appendRes?.data?.updates?.updatedColumns,
    updatedCells: appendRes?.data?.updates?.updatedCells,
  });

  return {
    asked_count: 1,
    first_asked_at: now,
    last_asked_at: now,
  };
}

/**
 * メイン保存関数
 */
async function saveQuestionStock(input = {}) {
  try {
    console.log("[questionStockService] DEBUG TARGET", {
      SPREADSHEET_ID,
      SHEET_NAME,
    });

    console.log("[questionStockService.saveQuestionStock] INPUT", input);

    if (!SPREADSHEET_ID) {
      throw new Error("SPREADSHEET_ID is missing");
    }

    const payload = {
      user_id: toSafeString(input.user_id),
      bot_id: toSafeString(input.bot_id),
      question: toSafeString(input.question),
      normalized_question: toSafeString(input.normalized_question),
      company_id: toSafeString(input.company_id),
      user_question: toSafeString(input.user_question || input.question),
      wiki_answer: toSafeString(input.wiki_answer),
      review_note: toSafeString(input.review_note),
      question_category: toSafeString(input.question_category),
      group_key: toSafeString(input.group_key),
      canonical_question: toSafeString(input.canonical_question),
      draft_answer: toSafeString(input.draft_answer),
      draft_answer_source: toSafeString(input.draft_answer_source),
      adopted_at: toSafeString(input.adopted_at),
    };

    console.log("[questionStockService.saveQuestionStock] PAYLOAD", payload);

    if (!payload.question) {
      return {
        success: false,
        message: "question is required",
        data: null,
      };
    }

    if (!payload.normalized_question) {
      return {
        success: false,
        message: "normalized_question is required",
        data: null,
      };
    }

    const sheets = createSheetsClient();
    const now = new Date().toISOString();

    const stockRows = await getAllQuestionStockRows(sheets);
    const existingRow = findExistingStockRow(
      stockRows,
      payload.company_id,
      payload.normalized_question
    );

    console.log("[questionStockService.saveQuestionStock] EXISTING ROW", existingRow);

    if (existingRow) {
      console.log("[questionStockService.saveQuestionStock] ACTION", {
        type: "update",
        company_id: payload.company_id,
        normalized_question: payload.normalized_question,
      });

      const updated = await updateExistingStockRow(sheets, existingRow, now);

      return {
        success: true,
        message: "question_stock updated",
        data: {
          action: "update",
          company_id: payload.company_id,
          normalized_question: payload.normalized_question,
          asked_count: updated.asked_count,
          first_asked_at: updated.first_asked_at,
          last_asked_at: updated.last_asked_at,
          sheetRowNumber: updated.sheetRowNumber,
        },
      };
    }

    console.log("[questionStockService.saveQuestionStock] ACTION", {
      type: "append",
      company_id: payload.company_id,
      normalized_question: payload.normalized_question,
    });

    const appended = await appendNewStockRow(sheets, payload, now);

    return {
      success: true,
      message: "question_stock appended",
      data: {
        action: "append",
        company_id: payload.company_id,
        normalized_question: payload.normalized_question,
        asked_count: appended.asked_count,
        first_asked_at: appended.first_asked_at,
        last_asked_at: appended.last_asked_at,
      },
    };
  } catch (error) {
    console.error("[questionStockService.saveQuestionStock] error:", error);

    return {
      success: false,
      message: error.message || "Failed to save question_stock",
      data: null,
    };
  }
}

module.exports = {
  saveQuestionStock,
  getAllQuestionStockRows,
  findExistingStockRow,
};