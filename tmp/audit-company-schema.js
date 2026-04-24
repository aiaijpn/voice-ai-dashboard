"use strict";

require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const SPREADSHEET_ID = String(process.env.SPREADSHEET_ID || "").trim();
const SHEET_NAME = "company_master";

const EXPECTED_COLUMNS = [
  "company_id",
  "name",
  "display_name",
  "short_name",
  "aliases",
  "category",
  "tags",
  "search_tags",
  "show_in_ai",
  "show_in_list",
  "allow_fixed_theme",
  "allow_wiki",
  "allow_question_stock",
  "sponsor_status",
  "priority",
  "active",
];

const REQUIRED_COLUMNS = [
  "company_id",
  "name",
  "display_name",
  "show_in_ai",
  "show_in_list",
  "allow_fixed_theme",
  "allow_wiki",
  "allow_question_stock",
  "active",
];

const RECOMMENDED_COLUMNS = [
  "short_name",
  "aliases",
  "category",
  "tags",
  "search_tags",
  "sponsor_status",
  "priority",
];

const CURRENTLY_USED_COLUMNS = [
  "company_id",
  "name",
  "short_name",
  "category",
  "tags",
  "short_pitch",
  "site_url",
  "line_url",
  "map_url",
  "show_in_ai",
  "show_in_html",
  "sort_order",
  "priority",
];

const FUTURE_EXPECTED_COLUMNS = [
  "display_name",
  "aliases",
  "search_tags",
  "show_in_list",
  "allow_fixed_theme",
  "allow_wiki",
  "allow_question_stock",
  "sponsor_status",
  "active",
];

function toSafeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function uniq(items = []) {
  return Array.from(new Set(items.filter(Boolean)));
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

function buildNamingMigrationCandidates(headerColumns = []) {
  const candidates = [];

  if (headerColumns.includes("show_in_html")) {
    candidates.push({
      from: "show_in_html",
      to: "show_in_list",
      reason: "naming_migration_candidate",
    });
  }

  if (headerColumns.includes("show_in_list")) {
    candidates.push({
      from: "show_in_list",
      to: "show_in_html",
      reason: "naming_migration_candidate",
    });
  }

  return candidates;
}

function buildStatus(report = {}) {
  if (report.fetch_error || report.header_error) {
    return "FAIL";
  }

  if (report.missing_required_columns.length > 0) {
    return "FAIL";
  }

  if (
    report.missing_recommended_columns.length > 0 ||
    report.unexpected_columns.length > 0 ||
    report.naming_migration_candidates.length > 0
  ) {
    return "WARN";
  }

  return "PASS";
}

async function main() {
  const baseReport = {
    sheet_name: SHEET_NAME,
    spreadsheet_configured: Boolean(SPREADSHEET_ID),
    expected_columns: EXPECTED_COLUMNS,
    required_columns: REQUIRED_COLUMNS,
    recommended_columns: RECOMMENDED_COLUMNS,
    currently_used_columns: CURRENTLY_USED_COLUMNS,
    future_expected_columns: FUTURE_EXPECTED_COLUMNS,
    header_columns_raw: [],
    header_columns_normalized: [],
    missing_required_columns: [],
    missing_recommended_columns: [],
    unexpected_columns: [],
    present_but_unused_columns: [],
    naming_migration_candidates: [],
    row_count: 0,
    status: "FAIL",
  };

  try {
    const rows = await getSheetRows();

    if (!Array.isArray(rows) || rows.length === 0) {
      const report = {
        ...baseReport,
        header_error: "header row not found",
      };
      report.status = buildStatus(report);
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    const headerColumnsRaw = rows[0].map((value) => toSafeString(value));
    const headerColumnsNormalized = uniq(headerColumnsRaw);

    const missingRequiredColumns = REQUIRED_COLUMNS.filter(
      (column) => !headerColumnsNormalized.includes(column)
    );

    const missingRecommendedColumns = RECOMMENDED_COLUMNS.filter(
      (column) => !headerColumnsNormalized.includes(column)
    );

    const expectedOrUsedColumns = uniq([
      ...EXPECTED_COLUMNS,
      ...CURRENTLY_USED_COLUMNS,
    ]);

    const unexpectedColumns = headerColumnsNormalized.filter(
      (column) => !expectedOrUsedColumns.includes(column)
    );

    const presentButUnusedColumns = headerColumnsNormalized.filter(
      (column) =>
        !CURRENTLY_USED_COLUMNS.includes(column) &&
        (EXPECTED_COLUMNS.includes(column) || FUTURE_EXPECTED_COLUMNS.includes(column))
    );

    const namingMigrationCandidates =
      buildNamingMigrationCandidates(headerColumnsNormalized);

    const report = {
      ...baseReport,
      header_columns_raw: headerColumnsRaw,
      header_columns_normalized: headerColumnsNormalized,
      missing_required_columns: missingRequiredColumns,
      missing_recommended_columns: missingRecommendedColumns,
      unexpected_columns: unexpectedColumns,
      present_but_unused_columns: presentButUnusedColumns,
      naming_migration_candidates: namingMigrationCandidates,
      row_count: Math.max(rows.length - 1, 0),
    };

    report.status = buildStatus(report);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    const report = {
      ...baseReport,
      fetch_error: error?.message || "failed to fetch company_master",
    };
    report.status = buildStatus(report);
    console.log(JSON.stringify(report, null, 2));
  }
}

main();
