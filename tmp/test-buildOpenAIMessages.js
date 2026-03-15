"use strict";

/**
 * ADR-011 単発確認
 *
 * 対象:
 * - services/messageService/index.js
 *
 * 確認したいこと:
 * - mapHistoryItemToOpenAIMessages()
 * - buildHistoryMessages()
 * - buildOpenAIMessages()
 *
 * 実行例:
 * node tmp/test-buildOpenAIMessages.js
 */

const {
  mapHistoryItemToOpenAIMessages,
  buildHistoryMessages,
  buildOpenAIMessages,
} = require("../services/messageService");

function printSection(title) {
  console.log("\n==================================================");
  console.log(title);
  console.log("==================================================");
}

function assertEqual(actual, expected, label) {
  const ok = actual === expected;

  if (ok) {
    console.log(`✅ PASS: ${label}`);
  } else {
    console.error(`❌ FAIL: ${label}`);
    console.error("   actual  :", actual);
    console.error("   expected:", expected);
    process.exitCode = 1;
  }
}

function assertDeep(condition, label, detail) {
  if (condition) {
    console.log(`✅ PASS: ${label}`);
  } else {
    console.error(`❌ FAIL: ${label}`);
    if (detail) {
      console.error(detail);
    }
    process.exitCode = 1;
  }
}

function runMapHistoryItemTests() {
  printSection("1. mapHistoryItemToOpenAIMessages");

  const userItem = {
    sourceType: "user_message",
    userMessage: "前回の続きなんだけど",
  };

  const aiItem = {
    sourceType: "ai_reply",
    aiReply: "はい、続きをどうぞ。",
  };

  const adminItem = {
    sourceType: "admin_message",
    aiReply: "管理メッセージです",
  };

  const emptyUserItem = {
    sourceType: "user_message",
    userMessage: "",
  };

  const mappedUser = mapHistoryItemToOpenAIMessages(userItem);
  const mappedAi = mapHistoryItemToOpenAIMessages(aiItem);
  const mappedAdmin = mapHistoryItemToOpenAIMessages(adminItem);
  const mappedEmptyUser = mapHistoryItemToOpenAIMessages(emptyUserItem);

  assertEqual(mappedUser?.role, "user", "user_message -> user");
  assertEqual(
    mappedUser?.content,
    "前回の続きなんだけど",
    "user_message content mapped"
  );

  assertEqual(mappedAi?.role, "assistant", "ai_reply -> assistant");
  assertEqual(
    mappedAi?.content,
    "はい、続きをどうぞ。",
    "ai_reply content mapped"
  );

  assertEqual(mappedAdmin, null, "admin_message -> excluded");
  assertEqual(mappedEmptyUser, null, "empty user_message -> excluded");
}

function runBuildHistoryMessagesTests() {
  printSection("2. buildHistoryMessages");

  const historyItems = [
    {
      sourceType: "user_message",
      userMessage: "こんにちは",
    },
    {
      sourceType: "ai_reply",
      aiReply: "こんにちは。ご相談どうぞ。",
    },
    {
      sourceType: "admin_message",
      aiReply: "これは除外されるべき",
    },
    {
      sourceType: "user_message",
      userMessage: "料金のことを聞きたい",
    },
  ];

  const result = buildHistoryMessages(historyItems);

  console.log("buildHistoryMessages result =", JSON.stringify(result, null, 2));

  assertEqual(Array.isArray(result), true, "history messages is array");
  assertEqual(result.length, 3, "admin_message excluded, valid 3 remain");

  assertEqual(result[0]?.role, "user", "history[0] role");
  assertEqual(result[0]?.content, "こんにちは", "history[0] content");

  assertEqual(result[1]?.role, "assistant", "history[1] role");
  assertEqual(
    result[1]?.content,
    "こんにちは。ご相談どうぞ。",
    "history[1] content"
  );

  assertEqual(result[2]?.role, "user", "history[2] role");
  assertEqual(
    result[2]?.content,
    "料金のことを聞きたい",
    "history[2] content"
  );
}

function runBuildOpenAIMessagesTests() {
  printSection("3. buildOpenAIMessages");

  const systemPrompt = "あなたは丁寧な日本語で対応するAIです。";
  const historyItems = [
    {
      sourceType: "user_message",
      userMessage: "ゴルフの相談です",
    },
    {
      sourceType: "ai_reply",
      aiReply: "承知しました。状況を教えてください。",
    },
    {
      sourceType: "admin_message",
      aiReply: "これは履歴に入れない",
    },
    {
      sourceType: "user_message",
      userMessage: "ドライバーが安定しません",
    },
  ];
  const text = "それって何が原因ですか？";

  const messages = buildOpenAIMessages({
    systemPrompt,
    historyItems,
    text,
  });

  console.log("buildOpenAIMessages result =", JSON.stringify(messages, null, 2));

  assertEqual(Array.isArray(messages), true, "messages is array");
  assertEqual(messages.length, 4, "system + 3 history/current user");

  assertEqual(messages[0]?.role, "system", "messages[0] is system");
  assertEqual(
    messages[0]?.content,
    systemPrompt,
    "messages[0] system content"
  );

  assertEqual(messages[1]?.role, "user", "messages[1] is history user");
  assertEqual(
    messages[1]?.content,
    "ゴルフの相談です",
    "messages[1] content"
  );

  assertEqual(
    messages[2]?.role,
    "assistant",
    "messages[2] is history assistant"
  );
  assertEqual(
    messages[2]?.content,
    "承知しました。状況を教えてください。",
    "messages[2] content"
  );

  assertEqual(messages[3]?.role, "user", "messages[3] is current user");
  assertEqual(
    messages[3]?.content,
    text,
    "messages[3] current user content"
  );

  const hasAdminText = messages.some(
    (m) => typeof m.content === "string" && m.content.includes("これは履歴に入れない")
  );

  assertEqual(hasAdminText, false, "admin_message not included");
}

function run() {
  printSection("ADR-011 test start");

  runMapHistoryItemTests();
  runBuildHistoryMessagesTests();
  runBuildOpenAIMessagesTests();

  printSection("ADR-011 test finished");

  if (process.exitCode && process.exitCode !== 0) {
    console.error("❌ Some tests failed");
  } else {
    console.log("✅ All tests passed");
  }
}

run();