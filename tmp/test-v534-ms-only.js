"use strict";

/**
 * V5.34 messageService専用テスト
 *
 * 目的:
 * - messageService（runV35）を100%通す
 * - fallback禁止
 * - エラーは握りつぶさず即落とす
 *
 * 実行:
 * node test-v534-ms-only.js
 */

require("dotenv").config();

const { runV35 } = require("../services/v35"); // ←パス要確認

// タイムスタンプ
function now() {
  return new Date().toISOString();
}

// テストケース（まずは最小）
const testFlow = [
  { text: "スーツを作りたい" },
  { text: "駐車場は？" },
];

// 疑似履歴
let conversationHistory = [];

async function runTest() {
  console.log("======================================");
  console.log(" V5.34 messageService 強制通過テスト");
  console.log("======================================");
  console.log("START:", now());
  console.log("");

  for (let i = 0; i < testFlow.length; i++) {
    const step = testFlow[i];

    console.log(`--- STEP ${i + 1} ---`);
    console.log("[USER]", step.text);

    const start = Date.now();

    try {
      const result = await runV35({
        rid: `test-${i + 1}`,
        userId: "test-user",
        userMessage: step.text,
        conversationHistory,
      });

      const ms = Date.now() - start;

      if (!result.success) {
        console.error("❌ runV35 failed");
        console.error(result);
        throw new Error("STOP TEST"); // ←止める
      }

      const data = result.data || {};

      console.log("[AI]", data.replyText);
      console.log("[topicLabel]", data.topicLabel);
      console.log("[companyId]", data.matchedCompanyId);
      console.log(`time: ${ms}ms`);

      // 履歴更新（最低限）
      conversationHistory.push({
        role: "user",
        content: step.text,
      });

      conversationHistory.push({
        role: "assistant",
        content: data.replyText,
      });

      console.log("");

    } catch (err) {
      console.error("💥 EXCEPTION OCCURRED");
      console.error("name:", err?.name);
      console.error("message:", err?.message);
      console.error("stack:", err?.stack);
      console.log("");
      console.log("⛔ TEST STOPPED");
      console.log("TIME:", now());
      process.exit(1); // ←即終了
    }
  }

  console.log("======================================");
  console.log(" TEST FINISHED SUCCESSFULLY");
  console.log("END:", now());
  console.log("======================================");
}

runTest();