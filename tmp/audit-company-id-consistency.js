"use strict";

require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const {
  normalizeCompanyId,
  getCompanyIdAliases,
} = require("../services/company/companyIdNormalizer");
const { companyMaster } = require("../data/companyMaster");
const { answerRules } = require("../data/answerRules");

const SPREADSHEET_ID = String(process.env.SPREADSHEET_ID || "").trim();
const CONVERSATION_HISTORY_LIMIT = 500;

const SHEET_SPECS = {
  company_master: {
    range: "company_master!A:Z",
    extract: (rows = []) => {
      if (!Array.isArray(rows) || rows.length <= 1) {
        return [];
      }

      const header = rows[0].map((value) => String(value || "").trim());
      const companyIdIndex = header.indexOf("company_id");

      if (companyIdIndex < 0) {
        throw new Error("company_master header does not contain company_id");
      }

      return rows.slice(1).map((row, index) => ({
        row_number: index + 2,
        raw_id: String(row[companyIdIndex] || "").trim(),
      }));
    },
  },
  company_wiki: {
    range: "company_wiki!A:H",
    extract: (rows = []) => {
      if (!Array.isArray(rows) || rows.length <= 1) {
        return [];
      }

      return rows.slice(1).map((row, index) => ({
        row_number: index + 2,
        raw_id: String(row[0] || "").trim(),
      }));
    },
  },
  question_stock: {
    range: "question_stock!A:S",
    extract: (rows = []) => {
      if (!Array.isArray(rows) || rows.length <= 1) {
        return [];
      }

      return rows.slice(1).map((row, index) => ({
        row_number: index + 2,
        raw_id: String(row[5] || "").trim(),
      }));
    },
  },
  conversation_history: {
    range: "conversation_history!A:J",
    extract: (rows = []) => {
      if (!Array.isArray(rows) || rows.length <= 1) {
        return [];
      }

      const dataRows = rows.slice(1);
      const start = Math.max(dataRows.length - CONVERSATION_HISTORY_LIMIT, 0);

      return dataRows.slice(start).map((row, index) => ({
        row_number: start + index + 2,
        raw_id: String(row[9] || "").trim(),
      }));
    },
  },
};

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

function buildEntries(sourceName, items = [], options = {}) {
  const aliasMap = getCompanyIdAliases();
  const canonicalSet = options.canonicalSet || new Set();

  return items.map((item) => {
    const rawId = toSafeString(item.raw_id);
    const normalizedId = normalizeCompanyId(rawId);
    const isBlank = !rawId;
    const isLegacyAlias = Boolean(rawId && aliasMap[rawId]);
    const isChangedByNormalizer = rawId !== normalizedId;
    const isKnownInCompanyMaster = Boolean(
      normalizedId && canonicalSet.has(normalizedId)
    );
    const isUnknownAfterNormalize = Boolean(
      normalizedId && canonicalSet.size > 0 && !canonicalSet.has(normalizedId)
    );

    return {
      source: sourceName,
      row_number: item.row_number || null,
      raw_id: rawId,
      normalized_id: normalizedId,
      is_blank: isBlank,
      is_legacy_alias: isLegacyAlias,
      is_changed_by_normalizer: isChangedByNormalizer,
      is_known_in_company_master: isKnownInCompanyMaster,
      is_unknown_after_normalize: isUnknownAfterNormalize,
    };
  });
}

async function fetchSheetSource(sourceName, sheets) {
  const spec = SHEET_SPECS[sourceName];

  if (!SPREADSHEET_ID) {
    return {
      source: sourceName,
      status: "unavailable",
      error: "SPREADSHEET_ID is not set",
      entries: [],
    };
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: spec.range,
    });

    const rows = Array.isArray(response?.data?.values) ? response.data.values : [];
    const items = spec.extract(rows);

    return {
      source: sourceName,
      status: "ok",
      error: "",
      entries: items,
    };
  } catch (error) {
    return {
      source: sourceName,
      status: "unavailable",
      error: error?.message || `failed to fetch ${sourceName}`,
      entries: [],
    };
  }
}

function fetchStaticCompanyMasterSource() {
  try {
    const items = Array.isArray(companyMaster)
      ? companyMaster.map((item, index) => ({
          row_number: index + 1,
          raw_id: toSafeString(item?.id),
        }))
      : [];

    return {
      source: "data_company_master",
      status: "ok",
      error: "",
      entries: items,
    };
  } catch (error) {
    return {
      source: "data_company_master",
      status: "unavailable",
      error: error?.message || "failed to load data/companyMaster.js",
      entries: [],
    };
  }
}

function fetchAnswerRulesSource() {
  try {
    const items = Array.isArray(answerRules)
      ? answerRules
          .map((item, index) => ({
            row_number: index + 1,
            raw_id: toSafeString(item?.linked_company_id),
          }))
          .filter((item) => item.raw_id)
      : [];

    return {
      source: "answer_rules",
      status: "ok",
      error: "",
      entries: items,
    };
  } catch (error) {
    return {
      source: "answer_rules",
      status: "unavailable",
      error: error?.message || "failed to load data/answerRules.js",
      entries: [],
    };
  }
}

function summarizeSource(source = {}) {
  const entries = Array.isArray(source.entries) ? source.entries : [];

  return {
    status: source.status,
    error: source.error || "",
    row_count: entries.length,
    blank_id_count: entries.filter((item) => item.is_blank).length,
    legacy_alias_count: entries.filter((item) => item.is_legacy_alias).length,
    unknown_id_count: entries.filter((item) => item.is_unknown_after_normalize)
      .length,
    unique_raw_ids: uniq(entries.map((item) => item.raw_id)),
    unique_normalized_ids: uniq(entries.map((item) => item.normalized_id)),
  };
}

function buildStatus(report = {}) {
  const companyMasterStatus = report.source_status?.company_master;

  if (!companyMasterStatus || companyMasterStatus !== "ok") {
    return "FAIL";
  }

  const criticalSources = [
    "company_master",
    "company_wiki",
    "question_stock",
    "answer_rules",
  ];

  const anyCriticalUnavailable = criticalSources.some(
    (source) => report.source_status?.[source] === "unavailable"
  );

  if (anyCriticalUnavailable) {
    return "FAIL";
  }

  const anyCriticalUnknown = criticalSources.some(
    (source) => (report.summary?.[source]?.unknown_id_count || 0) > 0
  );

  if (anyCriticalUnknown) {
    return "FAIL";
  }

  const anyLegacy = Object.values(report.summary || {}).some(
    (item) => (item?.legacy_alias_count || 0) > 0
  );

  const anyConversationUnknown =
    (report.summary?.conversation_history?.unknown_id_count || 0) > 0;

  if (anyLegacy || anyConversationUnknown) {
    return "WARN";
  }

  return "PASS";
}

async function main() {
  const report = {
    spreadsheet_configured: Boolean(SPREADSHEET_ID),
    conversation_history_limit: CONVERSATION_HISTORY_LIMIT,
    alias_map: getCompanyIdAliases(),
    source_status: {},
    source_errors: {},
    summary: {},
    raw_to_normalized_changes: [],
    legacy_alias_ids_found: [],
    unknown_ids_found: [],
    blank_ids_found: [],
    diffs_against_company_master: {},
    status: "FAIL",
  };

  let sheets = null;

  try {
    sheets = createSheetsClient();
  } catch (error) {
    sheets = null;
    report.sheets_client_error = error?.message || "failed to create sheets client";
  }

  const liveSources = ["company_master", "company_wiki", "question_stock", "conversation_history"];
  const sourceResults = {};

  for (const sourceName of liveSources) {
    if (!sheets) {
      sourceResults[sourceName] = {
        source: sourceName,
        status: "unavailable",
        error: report.sheets_client_error || "sheets client unavailable",
        entries: [],
      };
      continue;
    }

    sourceResults[sourceName] = await fetchSheetSource(sourceName, sheets);
  }

  sourceResults.data_company_master = fetchStaticCompanyMasterSource();
  sourceResults.answer_rules = fetchAnswerRulesSource();

  const canonicalSet = new Set(
    sourceResults.company_master.entries
      .map((item) => normalizeCompanyId(item.raw_id))
      .filter(Boolean)
  );

  for (const [sourceName, sourceResult] of Object.entries(sourceResults)) {
    const entries = buildEntries(sourceName, sourceResult.entries, {
      canonicalSet,
    });

    sourceResult.entries = entries;
    report.source_status[sourceName] = sourceResult.status;
    report.source_errors[sourceName] = sourceResult.error || "";
    report.summary[sourceName] = summarizeSource(sourceResult);
  }

  const allEntries = Object.values(sourceResults).flatMap((source) => source.entries);

  report.raw_to_normalized_changes = allEntries.filter(
    (item) => item.is_changed_by_normalizer
  );
  report.legacy_alias_ids_found = allEntries.filter((item) => item.is_legacy_alias);
  report.unknown_ids_found = allEntries.filter(
    (item) => item.is_unknown_after_normalize
  );
  report.blank_ids_found = allEntries.filter((item) => item.is_blank);

  const companyMasterIds = report.summary.company_master?.unique_normalized_ids || [];

  report.diffs_against_company_master = {
    company_wiki_not_in_company_master: (
      report.summary.company_wiki?.unique_normalized_ids || []
    ).filter((id) => !companyMasterIds.includes(id)),
    question_stock_not_in_company_master: (
      report.summary.question_stock?.unique_normalized_ids || []
    ).filter((id) => !companyMasterIds.includes(id)),
    conversation_history_not_in_company_master: (
      report.summary.conversation_history?.unique_normalized_ids || []
    ).filter((id) => !companyMasterIds.includes(id)),
    data_company_master_not_in_company_master: (
      report.summary.data_company_master?.unique_normalized_ids || []
    ).filter((id) => !companyMasterIds.includes(id)),
    answer_rule_ids_not_in_company_master: (
      report.summary.answer_rules?.unique_normalized_ids || []
    ).filter((id) => !companyMasterIds.includes(id)),
  };

  report.status = buildStatus(report);

  console.log(JSON.stringify(report, null, 2));
}

main();
