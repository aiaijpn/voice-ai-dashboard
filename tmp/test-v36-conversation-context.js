"use strict";

const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const { processMessage } = require("../services/messageService");

const BOT_ID = "test_bot_v36";
const USER_ID = "test_user_v36";

async function run() {
  console.log("=== V3.6 Conversation Test START ===");
  console.log("time:", new Date().toISOString());
  console.log("OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);

  const scenarios = [
    {
      name: "スーツ継続テスト",
      steps: ["スーツを作りたい", "駐車場ある？"],
    },
    {
      name: "相続継続テスト",
      steps: ["相続について相談したい", "費用はいくら？"],
    },
    {
      name: "話題転換テスト",
      steps: ["スーツを作りたい", "今日の天気は？"],
    },
    {
      name: "AI話題転換テスト",
      steps: ["相続について相談したい", "AI活用のコツは？"],
    },
  ];

  let totalCalls = 0;

  for (const scenario of scenarios) {
    console.log("\n==============================");
    console.log("Scenario:", scenario.name);
    console.log("==============================");

    for (const userMessage of scenario.steps) {
      console.log("\n---");
      console.log("User:", userMessage);

      const start = Date.now();

      const res = await processMessage({
        rid: `test_${Date.now()}`,
        bot_id: BOT_ID,
        userId: USER_ID,
        text: userMessage,
      });

      const end = Date.now();
      totalCalls++;

      if (!res.success) {
        console.log("❌ ERROR:", res.message);
        console.log("data:", res.data || null);
        continue;
      }

      const data = res.data || {};

      console.log("AI:", data.replyText || "");

      // 本当に返ってきた最終 companyId をそのまま表示する
      console.log("companyId:", data.companyId || "");

      // デバッグ用に currentCompanyId も分けて表示する
      console.log("currentCompanyId:", data.currentCompanyId || "");

      console.log("topicLabel:", data.topicLabel || "");
      console.log("time(ms):", end - start);
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log("OpenAI calls:", totalCalls);
  console.log("time:", new Date().toISOString());
  console.log("=== END ===");
}

run().catch((err) => {
  console.error("FATAL:", err);
});