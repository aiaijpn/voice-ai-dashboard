"use strict";

/**
 * companySheetService
 *
 * 役割:
 * - Google Sheets の company_master シートを読む
 * - 1行ずつ company オブジェクトとして返す
 *
 * 方針:
 * - V3.52 最小実装
 * - まずは全件取得のみ
 * - 列番号固定ではなく、ヘッダ名で安全に読む
 */

const { google } = require("googleapis");

const SPREADSHEET_ID = String(process.env.SPREADSHEET_ID || "").trim();
const SHEET_NAME = "company_master";

/**
 * Sheets client
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
      throw new Error(`Service account file not found: ${resolvedPath}`);
    }

    credentials = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  } else if (rawJson) {
    credentials = JSON.parse(rawJson);
  } else {
    throw new Error("Google service account credentials are not set.");
  }

  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
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
 * 安全文字列化
 */
function toSafeString(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

/**
 * ヘッダ行を index map 化
 */
function buildHeaderMap(headerRow = []) {
  return headerRow.reduce((acc, cell, index) => {
    const key = toSafeString(cell);
    if (key) {
      acc[key] = index;
    }
    return acc;
  }, {});
}

/**
 * row からヘッダ名で値取得
 */
function getCell(row = [], headerMap = {}, key = "") {
  const index = headerMap[key];
  if (index === undefined) {
    return "";
  }
  return toSafeString(row[index]);
}

/**
 * 行配列 → object
 */
function mapRowToCompany(row = [], headerMap = {}) {
  return {
    company_id: getCell(row, headerMap, "company_id"),
    name: getCell(row, headerMap, "name"),
    short_name: getCell(row, headerMap, "short_name"),
    category: getCell(row, headerMap, "category"),
    tags: getCell(row, headerMap, "tags"),
    short_pitch: getCell(row, headerMap, "short_pitch"),
    site_url: getCell(row, headerMap, "site_url"),
    line_url: getCell(row, headerMap, "line_url"),
    map_url: getCell(row, headerMap, "map_url"),
    show_in_ai: getCell(row, headerMap, "show_in_ai"),
    show_in_html: getCell(row, headerMap, "show_in_html"),
    sort_order: getCell(row, headerMap, "sort_order"),
  };
}

/**
 * company_master 全件取得
 */
async function getAllCompaniesFromSheet() {
  if (!SPREADSHEET_ID) {
    throw new Error("SPREADSHEET_ID is not set.");
  }

  const sheets = createSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:Z`,
  });

  const rows = Array.isArray(res.data.values) ? res.data.values : [];

  if (rows.length <= 1) {
    return [];
  }

  const headerRow = rows[0];
  const dataRows = rows.slice(1);
  const headerMap = buildHeaderMap(headerRow);

  return dataRows
    .map((row) => mapRowToCompany(row, headerMap))
    .filter((company) => company.company_id);
}

module.exports = {
  getAllCompaniesFromSheet,
};