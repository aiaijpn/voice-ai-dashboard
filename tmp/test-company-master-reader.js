"use strict";

const assert = require("assert");
const {
  DEFAULT_PRIORITY,
  mapRowsToCompanies,
} = require("../services/company/companyMasterReader");

const rows = [
  [
    "company_id",
    "name",
    "display_name",
    "short_name",
    "category",
    "tags",
    "search_tags",
    "aliases",
    "priority",
    "active",
    "show_in_ai",
    "show_in_list",
    "allow_fixed_theme",
    "allow_wiki",
    "allow_question_stock",
    "sponsor_status",
  ],
  [
    "kanai_suits",
    "オーダースーツ金井",
    "オーダースーツ金井",
    "金井",
    "スーツ",
    "スーツ,オーダー、身だしなみ",
    "スーツ相談\nオーダースーツ",
    "金井,スーツ金井",
    "10",
    "TRUE",
    "true",
    "1",
    "yes",
    "on",
    "y",
    "active_sponsor",
  ],
  [
    "ikeda_law",
    "池田法律相談",
    "",
    "池田",
    "法律",
    "法律/弁護士",
    "法律相談",
    "池田法律",
    "",
    "false",
    "0",
    "",
    "0",
    "false",
    "",
    "paused",
  ],
  [
    "unknown_company",
    "未分類企業",
    "未分類企業",
    "",
    "",
    "",
    "",
    "",
    "",
    "TRUE",
    "FALSE",
    "FALSE",
    "FALSE",
    "FALSE",
    "FALSE",
    "",
  ],
];

async function main() {
  const companies = mapRowsToCompanies(rows);

  assert.strictEqual(companies.length, 3);

  const kanai = companies[0];
  assert.strictEqual(kanai.companyId, "kanai_suit");
  assert.strictEqual(kanai.name, "オーダースーツ金井");
  assert.strictEqual(kanai.displayName, "オーダースーツ金井");
  assert.strictEqual(kanai.shortName, "金井");
  assert.strictEqual(kanai.category, "スーツ");
  assert.deepStrictEqual(kanai.tags, ["スーツ", "オーダー", "身だしなみ"]);
  assert.deepStrictEqual(kanai.searchTags, ["スーツ相談", "オーダースーツ"]);
  assert.deepStrictEqual(kanai.aliases, ["金井", "スーツ金井"]);
  assert.strictEqual(kanai.priority, 10);
  assert.strictEqual(kanai.active, true);
  assert.strictEqual(kanai.showInAi, true);
  assert.strictEqual(kanai.showInList, true);
  assert.strictEqual(kanai.allowFixedTheme, true);
  assert.strictEqual(kanai.allowWiki, true);
  assert.strictEqual(kanai.allowQuestionStock, true);
  assert.strictEqual(kanai.sponsorStatus, "active_sponsor");

  const ikeda = companies[1];
  assert.strictEqual(ikeda.companyId, "ikeda_law");
  assert.strictEqual(ikeda.displayName, "池田法律相談");
  assert.deepStrictEqual(ikeda.tags, ["法律", "弁護士"]);
  assert.strictEqual(ikeda.priority, DEFAULT_PRIORITY);
  assert.strictEqual(ikeda.active, false);
  assert.strictEqual(ikeda.showInAi, false);
  assert.strictEqual(ikeda.showInList, false);
  assert.strictEqual(ikeda.allowFixedTheme, false);
  assert.strictEqual(ikeda.allowWiki, false);
  assert.strictEqual(ikeda.allowQuestionStock, false);

  const unknown = companies[2];
  assert.strictEqual(unknown.companyId, "unknown_company");
  assert.strictEqual(unknown.active, true);
  assert.strictEqual(unknown.showInAi, false);

  const activeCompanies = companies.filter((company) => company.active);
  assert.deepStrictEqual(
    activeCompanies.map((company) => company.companyId),
    ["kanai_suit", "unknown_company"]
  );

  const aiCompanies = activeCompanies.filter((company) => company.showInAi);
  assert.deepStrictEqual(
    aiCompanies.map((company) => company.companyId),
    ["kanai_suit"]
  );

  const listCompanies = activeCompanies.filter((company) => company.showInList);
  assert.deepStrictEqual(
    listCompanies.map((company) => company.companyId),
    ["kanai_suit"]
  );

  const fixedThemeCompanies = activeCompanies.filter(
    (company) => company.allowFixedTheme
  );
  assert.deepStrictEqual(
    fixedThemeCompanies.map((company) => company.companyId),
    ["kanai_suit"]
  );

  const wikiCompanies = activeCompanies.filter((company) => company.allowWiki);
  assert.deepStrictEqual(
    wikiCompanies.map((company) => company.companyId),
    ["kanai_suit"]
  );

  const questionStockCompanies = activeCompanies.filter(
    (company) => company.allowQuestionStock
  );
  assert.deepStrictEqual(
    questionStockCompanies.map((company) => company.companyId),
    ["kanai_suit"]
  );

  console.log("PASS test-company-master-reader");
}

main();
