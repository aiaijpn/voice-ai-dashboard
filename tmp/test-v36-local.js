"use strict";

require("dotenv").config();

const path = require("path");
const fs = require("fs");

const START_AT = new Date();

function nowIso() {
  return new Date().toISOString();
}

function logSection(title) {
  console.log("\n" + "=".repeat(80));
  console.log(title);
  console.log("=".repeat(80));
}

function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return String(value);
  }
}

function extractReply(result) {
  if (!result) return "";

  if (typeof result === "string") return result;

  if (typeof result.replyText === "string") return result.replyText;
  if (typeof result.aiReply === "string") return result.aiReply;
  if (typeof result.message === "string") return result.message;
  if (typeof result.text === "string") return result.text;

  if (result.data) {
    if (typeof result.data.replyText === "string") return result.data.replyText;
    if (typeof result.data.aiReply === "string") return result.data.aiReply;
    if (typeof result.data.message === "string") return result.data.message;
    if (typeof result.data.text === "string") return result.data.text;
  }

  return "";
}

function extractJudge(result) {
  if (!result || typeof result !== "object") return null;

  if (result.judgeResult) return result.judgeResult;
  if (result.data && result.data.judgeResult) return result.data.judgeResult;

  return null;
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function assertIncludes(actual, expected) {
  if (!expected || expected.length === 0) return true;
  if (!hasText(actual)) return false;
  return expected.every((word) => actual.includes(word));
}

function assertExcludes(actual, ngWords) {
  if (!ngWords || ngWords.length === 0) return true;
  if (!hasText(actual)) return true;
  return ngWords.every((word) => !actual.includes(word));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveMessageServiceModule() {
  const candidates = [
    "../services/messageService",
    "../services/messageService/index.js",
  ];

  for (const rel of candidates) {
    const abs = path.resolve(__dirname, rel);
    if (fs.existsSync(abs) || fs.existsSync(abs + ".js")) {
      return require(abs);
    }
  }

  throw new Error(
    "messageService module が見つかりません。 ../services/messageService または ../services/messageService/index.js を確認してください。"
  );
}

function pickCallableExport(messageService) {
  const candidates = [
    "processMessage",
    "handleMessage",
    "handleUserMessage",
    "processUserMessage",
    "runMessageService",
    "executeMessageService",
    "main",
    "default",
  ];

  for (const key of candidates) {
    if (typeof messageService[key] === "function") {
      return {
        fn: messageService[key],
        name: key,
      };
    }
  }

  if (typeof messageService === "function") {
    return {
      fn: messageService,
      name: "(module.exports function)",
    };
  }

  throw new Error(
    "messageService の呼び出し関数を特定できませんでした。export 名を確認してください。"
  );
}

/**
 * V3.6 用:
 * processMessage({ botId, userId, text }) に固定する
 */
async function callMessageService(fn, userMessage, options = {}) {
  const {
    botId = "test-bot",
    userId = "local-user-001",
    replyToken = "dummy-reply-token",
    lineUserName = "ローカルテスト太郎",
  } = options;

  const payload = {
    botId,
    userId,
    text: userMessage,
    replyToken,
    lineUserName,
    sourceType: "user_message",
    testMode: true,
    isLocalTest: true,
  };

  const result = await fn(payload);

  return {
    ok: true,
    payloadUsed: payload,
    argsUsed: [payload],
    result,
  };
}

async function runScenario(messageFn, scenario) {
  const { name, botId, userId, steps } = scenario;

  logSection(`SCENARIO: ${name}`);

  const outputs = [];

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const stepNo = i + 1;

    console.log(`\n[${stepNo}] USER > ${step.input}`);

    const called = await callMessageService(messageFn, step.input, {
      botId,
      userId,
    });

    const result = called.result;
    const reply = extractReply(result);
    const judge = extractJudge(result);

    const passIncludes = assertIncludes(reply, step.expectIncludes || []);
    const passExcludes = assertExcludes(reply, step.expectExcludes || []);
    const passed = passIncludes && passExcludes;

    console.log(`[${stepNo}] PAYLOAD > ${safeStringify(called.payloadUsed)}`);
    console.log(`[${stepNo}] AI   > ${reply || "(reply text not found)"}`);

    if (judge) {
      console.log(`[${stepNo}] judgeResult > ${safeStringify(judge)}`);
    }

    console.log(`[${stepNo}] RESULT > ${passed ? "PASS" : "FAIL"}`);

    if (!passed) {
      console.log(
        `[${stepNo}] EXPECT includes > ${safeStringify(
          step.expectIncludes || []
        )}`
      );
      console.log(
        `[${stepNo}] EXPECT excludes > ${safeStringify(
          step.expectExcludes || []
        )}`
      );
      console.log(`[${stepNo}] RAW RESULT > ${safeStringify(result)}`);
    }

    outputs.push({
      stepNo,
      input: step.input,
      reply,
      judge,
      passed,
      rawResult: result,
    });

    await sleep(300);
  }

  const passedCount = outputs.filter((x) => x.passed).length;
  const failedCount = outputs.length - passedCount;

  console.log("\n--- scenario summary ---");
  console.log(`name   : ${name}`);
  console.log(`passed : ${passedCount}`);
  console.log(`failed : ${failedCount}`);

  return {
    name,
    passedCount,
    failedCount,
    outputs,
  };
}

async function main() {
  logSection("V3.6 LOCAL TEST START");
  console.log(`START: ${nowIso()}`);

  const requiredEnvKeys = ["OPENAI_API_KEY", "SPREADSHEET_ID"];

  for (const key of requiredEnvKeys) {
    console.log(`[ENV] ${key}: ${process.env[key] ? "OK" : "MISSING"}`);
  }

  const messageService = resolveMessageServiceModule();
  const picked = pickCallableExport(messageService);

  console.log(`messageService callable export: ${picked.name}`);

  const scenarios = [
    {
      name: "テーマ無し -> スーツ金井 -> 駐車場 継続",
      botId: "test-bot-v36",
      userId: "user-v36-001",
      steps: [
        {
          input: "スーツを作りたい",
          expectIncludes: ["金井"],
        },
        {
          input: "駐車場は？",
          expectIncludes: [],
          expectExcludes: ["池田法律", "ワイン小澤"],
        },
      ],
    },
    {
      name: "法律へ遷移 -> 継続確認",
      botId: "test-bot-v36",
      userId: "user-v36-002",
      steps: [
        {
          input: "法律相談したい",
          expectIncludes: ["法律"],
        },
        {
          input: "相続も相談できますか？",
          expectIncludes: [],
          expectExcludes: ["スーツ金井", "ワイン小澤"],
        },
      ],
    },
    {
      name: "ワイン -> 継続 -> テーマ外で解除されるか",
      botId: "test-bot-v36",
      userId: "user-v36-003",
      steps: [
        {
          input: "ワインに興味あります",
          expectIncludes: ["ワイン"],
        },
        {
          input: "初心者でも大丈夫？",
          expectIncludes: [],
          expectExcludes: ["池田法律", "スーツ金井"],
        },
        {
          input: "今日の天気は？",
          expectIncludes: [],
        },
      ],
    },
    {
      name: "テーマ無し一般質問",
      botId: "test-bot-v36",
      userId: "user-v36-004",
      steps: [
        {
          input: "AI活用の相談をしたい",
          expectIncludes: [],
        },
      ],
    },
    {
      name: "会話継続の最重要確認 3ターン",
      botId: "test-bot-v36",
      userId: "user-v36-005",
      steps: [
        {
          input: "オーダースーツについて知りたい",
          expectIncludes: ["スーツ", "金井"],
        },
        {
          input: "予約は必要？",
          expectIncludes: [],
          expectExcludes: ["池田法律", "ワイン小澤"],
        },
        {
          input: "場所はどこ？",
          expectIncludes: [],
          expectExcludes: ["池田法律", "ワイン小澤"],
        },
      ],
    },
  ];

  const allResults = [];

  for (const scenario of scenarios) {
    const result = await runScenario(picked.fn, scenario);
    allResults.push(result);
  }

  logSection("ALL SUMMARY");

  let totalPassed = 0;
  let totalFailed = 0;

  for (const scenarioResult of allResults) {
    totalPassed += scenarioResult.passedCount;
    totalFailed += scenarioResult.failedCount;

    console.log(
      `${scenarioResult.name} | passed=${scenarioResult.passedCount} failed=${scenarioResult.failedCount}`
    );
  }

  console.log("\nTOTAL");
  console.log(`passed=${totalPassed}`);
  console.log(`failed=${totalFailed}`);

  const END_AT = new Date();
  console.log(`\nSTART: ${START_AT.toISOString()}`);
  console.log(`END  : ${END_AT.toISOString()}`);
  console.log(
    `SEC  : ${Math.round((END_AT.getTime() - START_AT.getTime()) / 1000)}`
  );

  if (totalFailed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("\n[FATAL ERROR]");
  console.error(err && err.stack ? err.stack : err);
  console.error(`END: ${nowIso()}`);
  process.exit(1);
});