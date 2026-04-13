"use strict";

/**
 * tmp/test-v37-local.js
 *
 * 目的:
 * - V37 の3パターン固定をローカルで確認する
 * - serviceResponse 契約
 * - replyModeごとの返答
 * - question_stock保存の分岐
 *
 * 前提:
 * - services/v37/index.js が存在する
 * - 依存サービスが実装済みである
 *
 * 実行:
 * node tmp/test-v37-local.js
 */

require("dotenv").config();

const path = require("path");
const { runV37 } = require(path.resolve(__dirname, "../services/v37"));

function now() {
  return new Date().toISOString();
}

function printDivider(title = "") {
  console.log("\n==================================================");
  console.log(title);
  console.log("==================================================");
}

function printResult(label, result) {
  console.log(`\n[${label}] success:`, result?.success);
  console.log(`[${label}] message:`, result?.message || "");
  console.log(
    `[${label}] data:`,
    JSON.stringify(result?.data || null, null, 2)
  );
}

async function runOneTest(testCase) {
  printDivider(`START ${testCase.name}`);
  console.log("time:", now());

  try {
    const result = await runV37({
      rid: testCase.rid,
      bot_id: testCase.bot_id,
      userId: testCase.userId,
      userMessage: testCase.userMessage,
      conversationHistory: testCase.conversationHistory || [],
    });

    printResult(testCase.name, result);

    const data = result?.data || {};
    const replyText = String(data.replyText || "");
    const topicLabel = String(data.topicLabel || "");
    const companyId = String(data.companyId || "");
    const currentCompanyId = String(data.currentCompanyId || "");

    console.log(`\n[${testCase.name}] EXPECTATION`);
    console.log(testCase.expectation);

    console.log(`\n[${testCase.name}] QUICK CHECK`);
    console.log("- success:", Boolean(result?.success));
    console.log("- replyText exists:", Boolean(replyText));
    console.log("- topicLabel:", topicLabel);
    console.log("- companyId:", companyId);
    console.log("- currentCompanyId:", currentCompanyId);

    if (testCase.assertContains) {
      for (const text of testCase.assertContains) {
        console.log(
          `- reply includes "${text}":`,
          replyText.includes(text)
        );
      }
    }

    if (testCase.assertNotContains) {
      for (const text of testCase.assertNotContains) {
        console.log(
          `- reply NOT includes "${text}":`,
          !replyText.includes(text)
        );
      }
    }

    console.log("time:", now());
    printDivider(`END ${testCase.name}`);
  } catch (error) {
    console.error(`\n[${testCase.name}] ERROR:`, error?.message || error);
  }
}

async function main() {
  console.log("V37 local test start:", now());

  const tests = [
    {
      name: "CASE-1 wiki_hit",
      rid: "v37-test-001",
      bot_id: "voice-ai-dashboard",
      userId: "local-user-001",
      userMessage: "スーツ金井の駐車場はありますか？",
      conversationHistory: [],
      expectation:
        "company確定 + wikiヒット の場合、固定回答で reply されること。",
      assertContains: ["【", "】"],
      assertNotContains: [
        "どの内容についてのご質問でしょうか？",
        "情報は現在登録されておりません",
      ],
    },
    {
      name: "CASE-2 wiki_miss",
      rid: "v37-test-002",
      bot_id: "voice-ai-dashboard",
      userId: "local-user-002",
      userMessage: "スーツ金井の納期短縮オプションはありますか？",
      conversationHistory: [],
      expectation:
        "company確定 + wiki無し の場合、未回答テンプレが返り、question_stock保存へ進むこと。",
      assertContains: [
        "そのご質問についての情報は現在登録されておりません。",
        "お時間いただきますが、お調べいたします。",
        "【",
        "】",
      ],
      assertNotContains: ["どの内容についてのご質問でしょうか？"],
    },
    {
      name: "CASE-3 clarification",
      rid: "v37-test-003",
      bot_id: "voice-ai-dashboard",
      userId: "local-user-003",
      userMessage: "駐車場はありますか？",
      conversationHistory: [],
      expectation:
        "company不明 の場合、必ず clarification 固定文になること。",
      assertContains: [
        "どの内容についてのご質問でしょうか？",
        "会社名やテーマをもう少しだけ具体的に教えてください。",
        "【テーマ無し】",
      ],
      assertNotContains: [
        "そのご質問についての情報は現在登録されておりません。",
      ],
    },
  ];

  for (const testCase of tests) {
    await runOneTest(testCase);
  }

  console.log("\nV37 local test end:", now());
}

main().catch((error) => {
  console.error("FATAL:", error?.message || error);
  process.exit(1);
});