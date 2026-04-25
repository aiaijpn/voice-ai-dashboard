"use strict";

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const { normalizeCompanyId } = require("./companyIdNormalizer");

const SPREADSHEET_ID = String(process.env.SPREADSHEET_ID || "").trim();
const SHEET_NAME = "company_master";
const DEFAULT_PRIORITY = 999;

function toSafeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function toSafeBoolean(value) {
  const normalized = toSafeString(value).toLowerCase();

  return (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "on" ||
    normalized === "y"
  );
}

function toSafeNumber(value, fallback = DEFAULT_PRIORITY) {
  const safeValue = toSafeString(value);

  if (!safeValue) {
    return fallback;
  }

  const numericValue = Number(safeValue);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function splitMultiValue(value = "") {
  return Array.from(
    new Set(
      toSafeString(value)
        .split(/[,\n\r、\/]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function buildHeaderMap(headerRow = []) {
  return headerRow.reduce((accumulator, cellValue, index) => {
    const key = toSafeString(cellValue);

    if (key) {
      accumulator[key] = index;
    }

    return accumulator;
  }, {});
}

function getCell(row = [], headerMap = {}, key = "") {
  const index = headerMap[key];

  if (index === undefined) {
    return "";
  }

  return toSafeString(row[index]);
}

function createSheetsClient() {
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
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_FILE or GOOGLE_SERVICE_ACCOUNT_JSON is required"
    );
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

function mapRowToCompanyObject(row = [], headerMap = {}) {
  const raw = {
    company_id: getCell(row, headerMap, "company_id"),
    name: getCell(row, headerMap, "name"),
    display_name: getCell(row, headerMap, "display_name"),
    short_name: getCell(row, headerMap, "short_name"),
    category: getCell(row, headerMap, "category"),
    tags: getCell(row, headerMap, "tags"),
    search_tags: getCell(row, headerMap, "search_tags"),
    strong_tags: getCell(row, headerMap, "strong_tags"),
    keywords: getCell(row, headerMap, "keywords"),
    aliases: getCell(row, headerMap, "aliases"),
    priority: getCell(row, headerMap, "priority"),
    active: getCell(row, headerMap, "active"),
    show_in_ai: getCell(row, headerMap, "show_in_ai"),
    show_in_list: getCell(row, headerMap, "show_in_list"),
    show_in_html: getCell(row, headerMap, "show_in_html"),
    allow_fixed_theme: getCell(row, headerMap, "allow_fixed_theme"),
    allow_wiki: getCell(row, headerMap, "allow_wiki"),
    allow_question_stock: getCell(row, headerMap, "allow_question_stock"),
    sponsor_status: getCell(row, headerMap, "sponsor_status"),
  };

  const companyId = normalizeCompanyId(raw.company_id);
  const showInListRaw = raw.show_in_list || raw.show_in_html;

  return {
    companyId,
    name: raw.name,
    displayName: raw.display_name || raw.name,
    shortName: raw.short_name,
    category: raw.category,
    tags: splitMultiValue(raw.tags),
    searchTags: splitMultiValue(raw.search_tags),
    aliases: splitMultiValue(raw.aliases),
    priority: toSafeNumber(raw.priority, DEFAULT_PRIORITY),
    active: toSafeBoolean(raw.active),
    showInAi: toSafeBoolean(raw.show_in_ai),
    showInList: toSafeBoolean(showInListRaw),
    strongTags: splitMultiValue(raw.strong_tags),
    keywords: splitMultiValue(raw.keywords),
    allowFixedTheme: toSafeBoolean(raw.allow_fixed_theme),
    allowWiki: toSafeBoolean(raw.allow_wiki),
    allowQuestionStock: toSafeBoolean(raw.allow_question_stock),
    sponsorStatus: raw.sponsor_status,
    raw,
  };
}

function mapRowsToCompanies(rows = []) {
  if (!Array.isArray(rows) || rows.length <= 1) {
    return [];
  }

  const headerMap = buildHeaderMap(rows[0]);

  return rows
    .slice(1)
    .map((row) => mapRowToCompanyObject(row, headerMap))
    .filter((company) => company.companyId);
}

async function getSheetRows() {
  if (!SPREADSHEET_ID) {
    throw new Error("SPREADSHEET_ID is not set");
  }

  const sheets = createSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:Z`,
  });

  return Array.isArray(response?.data?.values) ? response.data.values : [];
}

async function getAllCompanies() {
  const rows = await getSheetRows();
  return mapRowsToCompanies(rows);
}

async function getActiveCompanies() {
  const companies = await getAllCompanies();
  return companies.filter((company) => company.active);
}

async function getCompanyById(companyId = "") {
  const normalizedCompanyId = normalizeCompanyId(companyId);

  if (!normalizedCompanyId) {
    return null;
  }

  const companies = await getAllCompanies();
  return companies.find((company) => company.companyId === normalizedCompanyId) || null;
}

async function getCompaniesForAi() {
  const companies = await getActiveCompanies();
  return companies.filter((company) => company.showInAi);
}

async function getCompaniesForList() {
  const companies = await getActiveCompanies();
  return companies.filter((company) => company.showInList);
}

async function getCompaniesForFixedTheme() {
  const companies = await getActiveCompanies();
  return companies.filter((company) => company.allowFixedTheme);
}

async function getCompaniesForWiki() {
  const companies = await getActiveCompanies();
  return companies.filter((company) => company.allowWiki);
}

async function getCompaniesForQuestionStock() {
  const companies = await getActiveCompanies();
  return companies.filter((company) => company.allowQuestionStock);
}

module.exports = {
  SHEET_NAME,
  DEFAULT_PRIORITY,
  toSafeString,
  toSafeBoolean,
  toSafeNumber,
  splitMultiValue,
  buildHeaderMap,
  getCell,
  mapRowToCompanyObject,
  mapRowsToCompanies,
  getAllCompanies,
  getActiveCompanies,
  getCompanyById,
  getCompaniesForAi,
  getCompaniesForList,
  getCompaniesForFixedTheme,
  getCompaniesForWiki,
  getCompaniesForQuestionStock,
};
