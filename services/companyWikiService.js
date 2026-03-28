"use strict";

/**
 * companyWikiService
 *
 * 役割:
 * - Google Sheets の company_wiki シートを読む
 * - company_id + normalized_question で wiki回答を探す
 *
 * 方針:
 * - V3.2 最小実装
 * - まずは完全一致のみ
 * - あいまい検索はしない
 */

const { google } = require("googleapis");
const { normalizeText } = require("../utils/textMatch");

const SPREADSHEET_ID = String(process.env.SPREADSHEET_ID || "").trim();
const COMPANY_WIKI_SHEET_NAME = "company_wiki";

/**
 * Google Sheets client 作成
 *
 * @returns {import("googleapis").sheets_v4.Sheets}
 */
function createSheetsClient() {
  const fs = require("fs");
  const path = require("path");

  const filePath = String(process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "").trim();
  const rawJson = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();

  let credentials = null;

  if (filePath) {
    const resolvedPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(
        `companyWikiService.createSheetsClient: service account file not found: ${resolvedPath}`
      );
    }

    const fileRaw = fs.readFileSync(resolvedPath, "utf8");
    credentials = JSON.parse(fileRaw);
  } else if (rawJson) {
    try {
      credentials = JSON.parse(rawJson);
    } catch (error) {
      throw new Error(
        `companyWikiService.createSheetsClient: invalid GOOGLE_SERVICE_ACCOUNT_JSON: ${error.message}`
      );
    }
  } else {
    throw new Error(
      "companyWikiService.createSheetsClient: GOOGLE_SERVICE_ACCOUNT_FILE or GOOGLE_SERVICE_ACCOUNT_JSON is required"
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({
    version: "v4",
    auth,
  });
}

/**
 * Sheets 1行を wikiオブジェクトへ変換
 *
 * 列順:
 * 0: company_id
 * 1: company_name
 * 2: question_pattern
 * 3: normalized_question
 * 4: answer_text
 * 5: status
 * 6: created_at
 * 7: updated_at
 *
 * @param {Array} row
 * @returns {Object}
 */
function mapRowToWikiItem(row = []) {
  return {
    company_id: row[0] || "",
    company_name: row[1] || "",
    question_pattern: row[2] || "",
    normalized_question: row[3] || "",
    answer_text: row[4] || "",
    status: row[5] || "",
    created_at: row[6] || "",
    updated_at: row[7] || "",
  };
}

/**
 * company_wiki 全件取得
 *
 * @returns {Promise<Array>}
 */
async function getAllCompanyWikiItems() {
  if (!SPREADSHEET_ID) {
    throw new Error(
      "companyWikiService.getAllCompanyWikiItems: SPREADSHEET_ID is required"
    );
  }

  const sheets = createSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${COMPANY_WIKI_SHEET_NAME}!A:H`,
  });

  const rows = Array.isArray(response?.data?.values) ? response.data.values : [];

  if (rows.length <= 1) {
    return [];
  }

  return rows.slice(1).map(mapRowToWikiItem);
}

/**
 * company_id + normalized_question で wiki回答を探す
 *
 * 条件:
 * - status === "active"
 * - company_id 一致
 * - normalized_question 完全一致
 *
 * @param {Object} params
 * @param {string} params.companyId
 * @param {string} params.userQuestion
 * @returns {Promise<{found:boolean,item:Object|null}>}
 */
async function findCompanyWikiAnswer({ companyId = "", userQuestion = "" }) {
  const safeCompanyId = String(companyId || "").trim();
  const normalizedQuestion = normalizeText(userQuestion);

  if (!safeCompanyId || !normalizedQuestion) {
    return {
      found: false,
      item: null,
    };
  }

  const items = await getAllCompanyWikiItems();

  const matched = items.find((item) => {
    return (
      item.status === "active" &&
      item.company_id === safeCompanyId &&
      normalizeText(item.normalized_question) === normalizedQuestion
    );
  });

  if (!matched) {
    return {
      found: false,
      item: null,
    };
  }

  return {
    found: true,
    item: matched,
  };
}

module.exports = {
  COMPANY_WIKI_SHEET_NAME,
  mapRowToWikiItem,
  getAllCompanyWikiItems,
  findCompanyWikiAnswer,
};