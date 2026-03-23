"use strict";

/**
 * V3.1 answerRule テスト
 *
 * 実行:
 * node tests/testAnswerRule.js
 */

const { findAnswerRule } = require("../services/answerRuleService");

/**
 * テストケース
 */
const testCases = [
  {
    input: "おすすめのクラブは？",
    expected: "三味線ファンクラブ矢吹",
  },
  {
    input: "スーツ作りたい",
    expected: "オーダースーツの金井",
  },
  {
    input: "相続が気になる",
    expected: "相続対策なら尾形",
  },
  {
    input: "法律相談したい",
    expected: "池田法律相談室",
  },
  {
    input: "関係ない質問",
    expected: null,
  },
];

/**
 * テスト実行
 */
function runTests() {
  console.log("===== V3.1 answerRule テスト開始 =====\n");

  testCases.forEach((test, index) => {
    const result = findAnswerRule(test.input);

    if (!result && test.expected === null) {
      console.log(`✅ [${index}] PASS`);
      console.log(`   input: ${test.input}`);
      console.log(`   result: null\n`);
      return;
    }

    if (!result) {
      console.log(`❌ [${index}] FAIL`);
      console.log(`   input: ${test.input}`);
      console.log(`   result: null`);
      console.log(`   expected: ${test.expected}\n`);
      return;
    }

    const pass = result.preferred_answer.includes(test.expected);

    if (pass) {
      console.log(`✅ [${index}] PASS`);
    } else {
      console.log(`❌ [${index}] FAIL`);
    }

    console.log(`   input: ${test.input}`);
    console.log(`   ruleId: ${result.id}`);
    console.log(`   answer: ${result.preferred_answer}`);
    console.log(`   expected keyword: ${test.expected}\n`);
  });

  console.log("===== テスト終了 =====");
}

runTests();