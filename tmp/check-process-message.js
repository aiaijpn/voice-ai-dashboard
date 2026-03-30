"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");

// ★ サービスアカウントJSONをenvにセット
const serviceAccountPath = path.resolve(
  __dirname,
  "../../voice-ai-dashboard-488404-8bf826020d17.json"
);

const serviceAccount = fs.readFileSync(serviceAccountPath, "utf-8");
process.env.GOOGLE_SERVICE_ACCOUNT_JSON = serviceAccount;

// ★ 本体
const { processMessage } = require("../services/messageService");

// ===== テスト用ユーザー =====
const TEST_USER_ID = "test_user_kanai";

// ===== テスト関数 =====
async function runTest() {
  console.log("========== TEST START ==========");

  // ① 1発目
  const input1 = {
    rid: "test_1",
    bot_id: "voice-ai-dashboard",
    userId: TEST_USER_ID,
    text: "オーダースーツの金井には駐車場ありますか？",
  };

  const res1 = await processMessage(input1);
  console.log("\n--- 1回目 ---");
  console.log(JSON.stringify(res1, null, 2));

  // ② 2発目（文脈テスト）
  const input2 = {
    rid: "test_2",
    bot_id: "voice-ai-dashboard",
    userId: TEST_USER_ID,
    text: "駐車場は？",
  };

  const res2 = await processMessage(input2);
  console.log("\n--- 2回目 ---");
  console.log(JSON.stringify(res2, null, 2));

  console.log("========== TEST END ==========");
}

runTest().catch((err) => {
  console.error("❌ TEST ERROR:", err);
});