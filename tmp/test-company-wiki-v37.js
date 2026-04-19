"use strict";

/**
 * tmp/test-company-wiki-v37.js
 *
 * 目的:
 * - V37 の company_wiki 動作をローカルで確認する
 * - wiki_hit / wiki_miss / clarification / 会話継続 を確認する
 *
 * 前提:
 * - services/v37/index.js が存在する
 * - company_wiki シートにテストデータが入っている
 *
 * 実行:
 * node tmp/test-company-wiki-v37.js
 * node tmp/test-company-wiki-v37.js > tmp/test-company-wiki-v37.log
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

function printQuickCheck(testCase, result) {
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
      console.log(`- reply includes "${text}":`, replyText.includes(text));
    }
  }

  if (testCase.assertNotContains) {
    for (const text of testCase.assertNotContains) {
      console.log(`- reply NOT includes "${text}":`, !replyText.includes(text));
    }
  }
}

async function runOneTest(testCase) {
  printDivider(`START ${testCase.name}`);
  console.log("time:", now());
  console.log("userMessage:", testCase.userMessage);

  try {
    const result = await runV37({
      rid: testCase.rid,
      bot_id: testCase.bot_id,
      userId: testCase.userId,
      userMessage: testCase.userMessage,
      conversationHistory: testCase.conversationHistory || [],
    });

    printResult(testCase.name, result);
    printQuickCheck(testCase, result);

    console.log("time:", now());
    printDivider(`END ${testCase.name}`);
  } catch (error) {
    console.error(`\n[${testCase.name}] ERROR:`, error?.message || error);
  }
}

async function main() {
  console.log("company_wiki test start:", now());

  const tests = [
    {
      name: "CASE-1 wiki_hit_explicit_company",
      rid: "wiki-test-001",
      bot_id: "voice-ai-dashboard",
      userId: "local-user-001",
      userMessage: "スーツ金井の駐車場はありますか？",
      conversationHistory: [],
      expectation:
        "company確定 + wikiヒット。company_wiki の answer_text がそのまま返ること。",
      assertContains: ["駐車場", "【"],
      assertNotContains: [
        "どの内容についてのご質問でしょうか？",
        "そのご質問についての情報は現在登録されておりません。",
      ],
    },

    {
      name: "CASE-2 wiki_hit_explicit_company_reservation",
      rid: "wiki-test-002",
      bot_id: "voice-ai-dashboard",
      userId: "local-user-002",
      userMessage: "スーツ金井は予約必要ですか？",
      conversationHistory: [],
      expectation:
        "company確定 + wikiヒット。予約に関する登録済み回答が返ること。",
      assertContains: ["予約", "【"],
      assertNotContains: [
        "どの内容についてのご質問でしょうか？",
        "そのご質問についての情報は現在登録されておりません。",
      ],
    },

    {
      name: "CASE-3 wiki_miss_explicit_company",
      rid: "wiki-test-003",
      bot_id: "voice-ai-dashboard",
      userId: "local-user-003",
      userMessage: "スーツ金井の納期短縮オプションはありますか？",
      conversationHistory: [],
      expectation:
        "company確定 + wiki未登録。未回答テンプレが返り、question_stock保存対象になること。",
      assertContains: [
        "そのご質問についての情報は現在登録されておりません。",
        "お時間いただきますが、お調べいたします。",
        "【",
      ],
      assertNotContains: ["どの内容についてのご質問でしょうか？"],
    },

    {
      name: "CASE-4 clarification_no_company",
      rid: "wiki-test-004",
      bot_id: "voice-ai-dashboard",
      userId: "local-user-004",
      userMessage: "駐車場はありますか？",
      conversationHistory: [],
      expectation:
        "company不明。clarification固定文になり、wiki回答には行かないこと。",
      assertContains: [
        "どの内容についてのご質問でしょうか？",
        "会社名やテーマをもう少しだけ具体的に教えてください。",
        "【テーマ無し】",
      ],
      assertNotContains: [
        "そのご質問についての情報は現在登録されておりません。",
      ],
    },

    {
      name: "CASE-5 continuation_hit_from_history",
      rid: "wiki-test-005",
      bot_id: "voice-ai-dashboard",
      userId: "local-user-005",
      userMessage: "駐車場はありますか？",
      conversationHistory: [
        { role: "user", content: "スーツを作りたい" },
        { role: "assistant", content: "【オーダースーツ金井】スーツのご相談ですね。" },
      ],
      expectation:
        "会話継続で金井が推定されれば、clarificationではなくwikiヒットに寄ること。",
      assertContains: ["駐車場"],
      assertNotContains: ["どの内容についてのご質問でしょうか？"],
    },

    {
      name: "CASE-6 continuation_miss_from_history",
      rid: "wiki-test-006",
      bot_id: "voice-ai-dashboard",
      userId: "local-user-006",
      userMessage: "納期短縮オプションはありますか？",
      conversationHistory: [
        { role: "user", content: "スーツを作りたい" },
        { role: "assistant", content: "【オーダースーツ金井】スーツのご相談ですね。" },
      ],
      expectation:
        "会話継続で金井が推定され、wiki未登録なら未回答テンプレに寄ること。",
      assertContains: [
        "そのご質問についての情報は現在登録されておりません。",
      ],
      assertNotContains: ["どの内容についてのご質問でしょうか？"],
    },
  ];

  for (const testCase of tests) {
    await runOneTest(testCase);
  }

  console.log("\ncompany_wiki test end:", now());
}

main().catch((error) => {
  console.error("FATAL:", error?.message || error);
  process.exit(1);
});