"use strict";

require("dotenv").config({ quiet: true });

const {
  getCompaniesForWiki,
  getCompaniesForQuestionStock,
  getAllCompanies,
} = require("../services/company/companyMasterReader");
const { getAllCompanyWikiItems } = require("../services/companyWikiService");
const {
  getAllQuestionStockRows,
} = require("../services/questionStockService");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const SPREADSHEET_ID = String(process.env.SPREADSHEET_ID || "").trim();

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

function summarizeIds(items = [], key = "companyId") {
  return uniq(items.map((item) => toSafeString(item?.[key])));
}

function buildUnknownAndNotAllowed(ids = [], allowedSet = new Set(), allSet = new Set()) {
  const unknown = [];
  const notAllowed = [];

  ids.forEach((companyId) => {
    if (!companyId) {
      return;
    }

    if (!allSet.has(companyId)) {
      unknown.push(companyId);
      return;
    }

    if (!allowedSet.has(companyId)) {
      notAllowed.push(companyId);
    }
  });

  return {
    unknown: uniq(unknown),
    notAllowed: uniq(notAllowed),
  };
}

async function main() {
  const report = {
    spreadsheetConfigured: Boolean(SPREADSHEET_ID),
    allowWikiCompanies: [],
    allowQuestionStockCompanies: [],
    companyWiki: {
      status: "ok",
      totalRows: 0,
      uniqueCompanyIds: [],
      unknownCompanyIds: [],
      notAllowedCompanyIds: [],
    },
    questionStock: {
      status: "ok",
      totalRows: 0,
      uniqueCompanyIds: [],
      unknownCompanyIds: [],
      notAllowedCompanyIds: [],
    },
    status: "FAIL",
  };

  try {
    const [allCompanies, wikiAllowedCompanies, stockAllowedCompanies] =
      await Promise.all([
        getAllCompanies(),
        getCompaniesForWiki(),
        getCompaniesForQuestionStock(),
      ]);

    const allCompanyIdSet = new Set(summarizeIds(allCompanies, "companyId"));
    const wikiAllowedIds = summarizeIds(wikiAllowedCompanies, "companyId");
    const stockAllowedIds = summarizeIds(stockAllowedCompanies, "companyId");

    report.allowWikiCompanies = wikiAllowedCompanies.map((company) => ({
      companyId: company.companyId,
      displayName: company.displayName,
    }));

    report.allowQuestionStockCompanies = stockAllowedCompanies.map((company) => ({
      companyId: company.companyId,
      displayName: company.displayName,
    }));

    const wikiItems = await getAllCompanyWikiItems();
    const wikiIds = uniq(
      wikiItems
        .map((item) => toSafeString(item.company_id))
        .filter(Boolean)
    );

    const wikiAudit = buildUnknownAndNotAllowed(
      wikiIds,
      new Set(wikiAllowedIds),
      allCompanyIdSet
    );

    report.companyWiki.totalRows = wikiItems.length;
    report.companyWiki.uniqueCompanyIds = wikiIds;
    report.companyWiki.unknownCompanyIds = wikiAudit.unknown;
    report.companyWiki.notAllowedCompanyIds = wikiAudit.notAllowed;

    const sheets = createSheetsClient();
    const stockRows = await getAllQuestionStockRows(sheets);
    const stockIds = uniq(
      stockRows
        .map((row) => toSafeString(row.company_id))
        .filter(Boolean)
    );

    const stockAudit = buildUnknownAndNotAllowed(
      stockIds,
      new Set(stockAllowedIds),
      allCompanyIdSet
    );

    report.questionStock.totalRows = stockRows.length;
    report.questionStock.uniqueCompanyIds = stockIds;
    report.questionStock.unknownCompanyIds = stockAudit.unknown;
    report.questionStock.notAllowedCompanyIds = stockAudit.notAllowed;

    const hasIssues =
      wikiAudit.unknown.length > 0 ||
      wikiAudit.notAllowed.length > 0 ||
      stockAudit.unknown.length > 0 ||
      stockAudit.notAllowed.length > 0;

    report.status = hasIssues ? "WARN" : "PASS";
  } catch (error) {
    report.status = "FAIL";
    report.error = error?.message || "audit-company-allow-flags failed";
  }

  console.log(JSON.stringify(report, null, 2));
}

main();
