"use strict";

const assert = require("assert");
const {
  normalizeCompanyId,
  isCanonicalCompanyId,
  getCompanyIdAliases,
} = require("../services/company/companyIdNormalizer");

const cases = [
  ["ikeda_legal", "ikeda_law"],
  ["kanai_suits", "kanai_suit"],
  ["ikeda_law", "ikeda_law"],
  ["kanai_suit", "kanai_suit"],
  ["unknown_company", "unknown_company"],
  [null, ""],
  [undefined, ""],
  ["", ""],
];

let passed = 0;

for (const [input, expected] of cases) {
  const actual = normalizeCompanyId(input);
  assert.strictEqual(
    actual,
    expected,
    `normalizeCompanyId(${String(input)}) expected=${expected} actual=${actual}`
  );
  passed += 1;
}

const aliases = getCompanyIdAliases();
assert.deepStrictEqual(aliases, {
  ikeda_legal: "ikeda_law",
  kanai_suits: "kanai_suit",
});
passed += 1;

assert.strictEqual(isCanonicalCompanyId("ikeda_law"), true);
passed += 1;

assert.strictEqual(isCanonicalCompanyId("kanai_suit"), true);
passed += 1;

assert.strictEqual(isCanonicalCompanyId("ikeda_legal"), false);
passed += 1;

assert.strictEqual(isCanonicalCompanyId("kanai_suits"), false);
passed += 1;

assert.strictEqual(isCanonicalCompanyId("unknown_company"), false);
passed += 1;

assert.strictEqual(isCanonicalCompanyId(""), false);
passed += 1;

console.log(`PASS test-company-id-normalizer (${passed} assertions)`);
