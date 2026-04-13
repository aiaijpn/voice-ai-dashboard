"use strict";

/**
 * tmp/test-question-stock.js
 *
 * 目的:
 * - V37で question_stock が保存されるか確認
 */

require("dotenv").config();

const { runV37 } = require("../services/v37");

async function runTest() {
  console.log("=== QUESTION STOCK TEST START ===\n");

  const testCases = [
    {
      name: "stock-hit-1",
      message: "スーツ金井の納期短縮オプションはありますか？",
    },
    {
      name: "stock-hit-2",
      message: "オーダースーツ金井で当日仕上げは可能ですか？",
    },
    {
      name: "stock-hit-3",
      message: "スーツ金井でサブスクプランはありますか？",
    },
    {
      name: "stock-hit-4",
      message: "スーツ金井の保証内容は？",
    },
  ];

  for (const testCase of testCases) {
    console.log("========================================");
    console.log("CASE:", testCase.name);
    console.log("MESSAGE:", testCase.message);

    try {
      const result = await runV37({
        rid: `stock-test-${Date.now()}`,
        bot_id: 1,
        userId: 999,
        userMessage: testCase.message,
        conversationHistory: [],
      });

      console.log("\nRESULT:");
      console.log("success:", result.success);
      console.log("replyText:", result.data?.replyText);
      console.log("companyId:", result.data?.companyId);

      const isStockTarget =
        result.data?.replyText?.includes("情報は現在登録されておりません");

      console.log("\nCHECK:");
      console.log("shouldStock (wiki_miss):", isStockTarget);

      if (isStockTarget) {
        console.log("👉 EXPECT: question_stock に保存される");
      } else {
        console.log("👉 EXPECT: 保存されない（wiki_hit or clarification）");
      }
    } catch (err) {
      console.error("ERROR:", err.message);
    }

    console.log("\n");
  }

  console.log("=== QUESTION STOCK TEST END ===");
}

runTest();