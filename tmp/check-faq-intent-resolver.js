"use strict";

const assert = require("assert");
const { resolveFaqIntent } = require("../services/faqIntentResolver");

const cases = [
  ["駐車場は？", "parking"],
  ["駐車場はあるか？", "parking"],
  ["車停められる？", "parking"],
  ["予約必要？", "reservation"],
  ["何時まで？", "hours"],
  ["料金は？", "price"],
  ["場所どこ？", "location"],
  ["カード使える？", "payment"],
  ["おすすめは？", ""],
];

for (const [input, expectedFaqKey] of cases) {
  const result = resolveFaqIntent(input);
  const actualFaqKey = result.matched ? result.faqKey : "";

  assert.strictEqual(
    actualFaqKey,
    expectedFaqKey,
    `${input}: expected ${expectedFaqKey || "no match"}, got ${
      actualFaqKey || "no match"
    }`
  );

  console.log(input, "=>", result);
}

console.log("faqIntentResolver check ok");
