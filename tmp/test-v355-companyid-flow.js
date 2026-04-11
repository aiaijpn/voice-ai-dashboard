"use strict";

/**
 * V3.55 / V35 継続修正確認テスト
 *
 * 目的:
 * - collectV35Context の companyId 復元を確認
 * - slimWikiCandidates 欠落バグが消えたことを確認
 * - runV35 の 2ターン継続を確認
 * - runV35 の返り値に companyId が入ることを確認
 *
 * 実行:
 *   node test-v355-companyid-flow.js
 */

require("dotenv").config();

const { collectV35Context } = require("../services/v35/collectV35Context");
const { runV35 } = require("../services/v35");

function now() {
  return new Date().toISOString();
}

function printSection(title) {
  console.log("\n======================================");
  console.log(title);
  console.log("======================================");
}

function assertOrThrow(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function testCollectContextCompanyIdRecovery() {
  printSection("TEST 1: collectV35Context が companyId を履歴から拾えるか");

  const conversationHistory = [
    {
      sourceType: "user_message",
      userMessage: "スーツを作りたい",
      companyId: "kanai_suit",
    },
    {
      sourceType: "ai_reply",
      aiReply: "承知しました",
      companyId: "kanai_suit",
    },
    {
      sourceType: "user_message",
      userMessage: "駐車場は？",
      companyId: "",
    },
  ];

  const result = await collectV35Context({
    rid: "test-collect-1",
    userMessage: "駐車場は？",
    conversationHistory,
  });

  console.log("success:", result?.success);
  console.log("message:", result?.message);
  console.log("data.currentCompanyId:", result?.data?.currentCompanyId);
  console.log(
    "data.isConversationContinuing:",
    result?.data?.isConversationContinuing
  );

  assertOrThrow(result?.success === true, "collectV35Context failed");
  assertOrThrow(
    result?.data?.currentCompanyId === "kanai_suit",
    `currentCompanyId mismatch: ${result?.data?.currentCompanyId}`
  );
  assertOrThrow(
    result?.data?.isConversationContinuing === true,
    "isConversationContinuing should be true"
  );

  console.log("✅ TEST 1 PASS");
}

async function testCollectContextLegacyKeysRecovery() {
  printSection("TEST 2: collectV35Context が legacy key も拾えるか");

  const conversationHistory = [
    {
      matched_company_id: "ikeda_law",
      matched_company_name: "池田法律",
    },
  ];

  const result = await collectV35Context({
    rid: "test-collect-2",
    userMessage: "相談したい",
    conversationHistory,
  });

  console.log("success:", result?.success);
  console.log("data.currentCompanyId:", result?.data?.currentCompanyId);

  assertOrThrow(result?.success === true, "collectV35Context failed");
  assertOrThrow(
    result?.data?.currentCompanyId === "ikeda_law",
    `legacy key recovery failed: ${result?.data?.currentCompanyId}`
  );

  console.log("✅ TEST 2 PASS");
}

async function testRunV35TwoTurnFlow() {
  printSection("TEST 3: runV35 の2ターン継続確認");

  const history = [];

  console.log(`[${now()}] STEP 1 start`);
  const step1 = await runV35({
    rid: "test-runv35-1",
    bot_id: "voice-ai-dashboard",
    userId: "local-test-user",
    userMessage: "スーツを作りたい",
    conversationHistory: history,
  });

  console.log("STEP 1 success:", step1?.success);
  console.log("STEP 1 topicLabel:", step1?.data?.topicLabel);
  console.log("STEP 1 companyId:", step1?.data?.companyId);
  console.log("STEP 1 matchedCompanyId:", step1?.data?.matchedCompanyId);
  console.log("STEP 1 replyText:\n", step1?.data?.replyText);

  assertOrThrow(step1?.success === true, "runV35 step1 failed");
  assertOrThrow(
    !!step1?.data?.companyId || !!step1?.data?.matchedCompanyId,
    "step1 company not returned"
  );

  const step1CompanyId = step1?.data?.companyId || step1?.data?.matchedCompanyId;

  history.push({
    sourceType: "user_message",
    userMessage: "スーツを作りたい",
    companyId: step1CompanyId,
  });

  history.push({
    sourceType: "ai_reply",
    aiReply: step1?.data?.replyText || "",
    companyId: step1CompanyId,
  });

  console.log(`[${now()}] STEP 2 start`);
  const step2 = await runV35({
    rid: "test-runv35-2",
    bot_id: "voice-ai-dashboard",
    userId: "local-test-user",
    userMessage: "駐車場は？",
    conversationHistory: history,
  });

  console.log("STEP 2 success:", step2?.success);
  console.log("STEP 2 topicLabel:", step2?.data?.topicLabel);
  console.log("STEP 2 companyId:", step2?.data?.companyId);
  console.log("STEP 2 matchedCompanyId:", step2?.data?.matchedCompanyId);
  console.log("STEP 2 replyText:\n", step2?.data?.replyText);

  assertOrThrow(step2?.success === true, "runV35 step2 failed");

  const step2CompanyId = step2?.data?.companyId || step2?.data?.matchedCompanyId;

  assertOrThrow(
    !!step2CompanyId,
    "step2 company not returned"
  );

  assertOrThrow(
    step2CompanyId === step1CompanyId,
    `company continuity broken: step1=${step1CompanyId}, step2=${step2CompanyId}`
  );

  console.log("✅ TEST 3 PASS");
}

async function testRunV35ReturnShape() {
  printSection("TEST 4: runV35 の返り値 shape 確認");

  const result = await runV35({
    rid: "test-shape-1",
    bot_id: "voice-ai-dashboard",
    userId: "local-test-user",
    userMessage: "AI活用したい",
    conversationHistory: [],
  });

  console.log("success:", result?.success);
  console.log("data keys:", Object.keys(result?.data || {}));
  console.log("companyId:", result?.data?.companyId);
  console.log("matchedCompanyId:", result?.data?.matchedCompanyId);

  assertOrThrow(result?.success === true, "runV35 shape test failed");
  assertOrThrow(
    result?.data && typeof result.data === "object",
    "result.data missing"
  );
  assertOrThrow(
    "replyText" in result.data,
    "replyText missing"
  );
  assertOrThrow(
    "topicLabel" in result.data,
    "topicLabel missing"
  );
  assertOrThrow(
    "companyId" in result.data || "matchedCompanyId" in result.data,
    "companyId/matchedCompanyId missing"
  );

  console.log("✅ TEST 4 PASS");
}

async function main() {
  console.log("START:", now());

  try {
    await testCollectContextCompanyIdRecovery();
    await testCollectContextLegacyKeysRecovery();
    await testRunV35TwoTurnFlow();
    await testRunV35ReturnShape();

    printSection("ALL TESTS PASSED");
    console.log("END:", now());
    process.exit(0);
  } catch (error) {
    printSection("TEST FAILED");
    console.error("name:", error?.name);
    console.error("message:", error?.message);
    console.error("stack:", error?.stack);
    console.log("END:", now());
    process.exit(1);
  }
}

main();