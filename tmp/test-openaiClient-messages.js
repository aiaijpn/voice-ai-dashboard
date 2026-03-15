"use strict";

/**
 * ADR-011 単発確認
 *
 * 対象:
 * - services/messageService/openaiClient.js
 *
 * 確認したいこと:
 * - messages を渡したとき Responses API 用 input に変換されるか
 * - messages 未指定時に従来 fallback が動くか
 * - model / text.format / headers が想定通りか
 *
 * 実行例:
 * node tmp/test-openaiClient-messages.js
 */

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-api-key";
process.env.OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const path = require("path");
const axios = require("axios");

/**
 * axios.post を一時モックする
 */
let capturedRequest = null;

axios.post = async function mockAxiosPost(url, body, options) {
  capturedRequest = {
    url,
    body,
    options,
  };

  return {
    data: {
      id: "resp_test_001",
      status: "completed",
      output: [],
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
      },
    },
  };
};

/**
 * openaiClient は require 時に env を読むため、
 * env 設定と axios モックの後で読む
 */
const {
  callOpenAI,
  OPENAI_MODEL,
} = require(path.join(
  __dirname,
  "../services/messageService/openaiClient"
));

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

async function runMessagesModeTest() {
  printSection("1. messages mode");

  capturedRequest = null;

  const messages = [
    {
      role: "system",
      content: "あなたは丁寧な日本語で対応するAIです。",
    },
    {
      role: "user",
      content: "前回の続きです",
    },
    {
      role: "assistant",
      content: "はい、続きをどうぞ。",
    },
    {
      role: "user",
      content: "それって何が原因ですか？",
    },
  ];

  const logs = [];
  const log = (...args) => {
    logs.push(args);
  };

  const response = await callOpenAI({
    systemPrompt: "これは fallback 用の system",
    text: "これは fallback 用の user",
    messages,
    rid: "test_rid_messages",
    log,
  });

  console.log("capturedRequest.body.input =", JSON.stringify(capturedRequest?.body?.input, null, 2));

  assertDeep(!!response, "response returned");
  assertDeep(!!capturedRequest, "axios.post called");

  assertEqual(
    capturedRequest?.url,
    "https://api.openai.com/v1/responses",
    "request url"
  );

  assertEqual(capturedRequest?.body?.model, OPENAI_MODEL, "model applied");

  assertEqual(Array.isArray(capturedRequest?.body?.input), true, "input is array");
  assertEqual(capturedRequest?.body?.input?.length, 4, "messages length mapped");

  assertEqual(capturedRequest?.body?.input?.[0]?.role, "system", "input[0] role");
  assertEqual(
    capturedRequest?.body?.input?.[0]?.content?.[0]?.type,
    "input_text",
    "input[0] content[0] type"
  );
  assertEqual(
    capturedRequest?.body?.input?.[0]?.content?.[0]?.text,
    "あなたは丁寧な日本語で対応するAIです。",
    "input[0] text"
  );

  assertEqual(capturedRequest?.body?.input?.[1]?.role, "user", "input[1] role");
  assertEqual(
    capturedRequest?.body?.input?.[1]?.content?.[0]?.text,
    "前回の続きです",
    "input[1] text"
  );

  assertEqual(capturedRequest?.body?.input?.[2]?.role, "assistant", "input[2] role");
  assertEqual(
    capturedRequest?.body?.input?.[2]?.content?.[0]?.text,
    "はい、続きをどうぞ。",
    "input[2] text"
  );

  assertEqual(capturedRequest?.body?.input?.[3]?.role, "user", "input[3] role");
  assertEqual(
    capturedRequest?.body?.input?.[3]?.content?.[0]?.text,
    "それって何が原因ですか？",
    "input[3] text"
  );

  assertEqual(
    capturedRequest?.body?.text?.format?.type,
    "json_schema",
    "json_schema format type"
  );
  assertEqual(
    capturedRequest?.body?.text?.format?.name,
    "voice_analysis",
    "json_schema format name"
  );

  assertEqual(
    capturedRequest?.options?.headers?.Authorization,
    `Bearer ${process.env.OPENAI_API_KEY}`,
    "authorization header"
  );
  assertEqual(
    capturedRequest?.options?.headers?.["Content-Type"],
    "application/json",
    "content-type header"
  );

  assertEqual(capturedRequest?.options?.timeout, 30000, "timeout");

  assertDeep(logs.length >= 2, "log called");
}

async function runFallbackModeTest() {
  printSection("2. fallback mode");

  capturedRequest = null;

  const logs = [];
  const log = (...args) => {
    logs.push(args);
  };

  const systemPrompt = "あなたは簡潔に答えるAIです。";
  const text = "今日の予定を整理して";

  await callOpenAI({
    systemPrompt,
    text,
    rid: "test_rid_fallback",
    log,
  });

  console.log("capturedRequest.body.input =", JSON.stringify(capturedRequest?.body?.input, null, 2));

  assertDeep(!!capturedRequest, "axios.post called in fallback mode");
  assertEqual(Array.isArray(capturedRequest?.body?.input), true, "fallback input is array");
  assertEqual(capturedRequest?.body?.input?.length, 2, "fallback input length is 2");

  assertEqual(capturedRequest?.body?.input?.[0]?.role, "system", "fallback input[0] role");
  assertEqual(
    capturedRequest?.body?.input?.[0]?.content?.[0]?.text,
    systemPrompt,
    "fallback systemPrompt applied"
  );

  assertEqual(capturedRequest?.body?.input?.[1]?.role, "user", "fallback input[1] role");
  assertEqual(
    capturedRequest?.body?.input?.[1]?.content?.[0]?.text,
    text,
    "fallback text applied"
  );

  assertDeep(logs.length >= 2, "fallback log called");
}

async function run() {
  printSection("ADR-011 openaiClient test start");

  try {
    await runMessagesModeTest();
    await runFallbackModeTest();
  } catch (error) {
    console.error("❌ FAIL: unexpected error");
    console.error(error);
    process.exitCode = 1;
  }

  printSection("ADR-011 openaiClient test finished");

  if (process.exitCode && process.exitCode !== 0) {
    console.error("❌ Some tests failed");
  } else {
    console.log("✅ All tests passed");
  }
}

run();