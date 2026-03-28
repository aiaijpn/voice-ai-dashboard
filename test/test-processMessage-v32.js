"use strict";

require("dotenv").config();

const { processMessage } = require("../services/messageService/index");

async function runTest(label, text) {
  console.log("\n==============================");
  console.log(`TEST: ${label}`);
  console.log("==============================");

  try {
    const result = await processMessage({
      rid: `test-${Date.now()}`,
      userId: "test-user",
      text,
      bot_id: "voice-ai-dashboard",
    });

    console.log("INPUT:", text);
    console.log("OUTPUT:");
    console.dir(result, { depth: null });
  } catch (e) {
    console.error("ERROR:");
    console.error(e.message);
  }
}

(async () => {
  console.log("🚀 V3.2 統合テスト開始");

  /**
   * ① Wikiヒット
   */
  await runTest("Wiki HIT", "予約は必要ですか");

  /**
   * ② 未ヒット → AI + stock
   */
  await runTest("NO HIT", "営業時間は？");

  /**
   * ③ answerRule（既存）
   * ※ 適当にルールある質問に変える
   */
  await runTest("AnswerRule", "（ルール登録済みの質問）");

  console.log("\n✅ テスト完了");
})();