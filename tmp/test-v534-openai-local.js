"use strict";
require("dotenv").config();
/**
 * tmp/test-v534-openai-local.js
 *
 * 目的:
 * - LINE を使わずに、OpenAI込みで栄一ツールの会話コアを総合テストする
 * - 現在コミット時点で、文脈保持 / company類推 / AI返答 / usage を確認する
 *
 * 実行:
 *   node tmp/test-v534-openai-local.js
 *
 * 前提ENV:
 *   OPENAI_API_KEY=...
 *   OPENAI_MODEL=gpt-4o-mini   // 任意
 *   USDJPY=150                 // 任意（コスト円換算用）
 *
 * 必要に応じて:
 *   SPREADSHEET_ID=...
 *   GOOGLE_SERVICE_ACCOUNT_JSON=...
 *
 * 方針:
 * - まず既存の messageService 系を探して使う
 * - 見つからなければ OpenAI Responses API を直接叩く
 * - LINE webhook / LINE SDK は使わない
 */

const fs = require("fs");
const path = require("path");

// ------------------------------------------------------------
// 基本
// ------------------------------------------------------------

const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const OPENAI_MODEL = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
const USDJPY = Number(process.env.USDJPY || 150);

if (!OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY が未設定です。");
  process.exit(1);
}

function color(text, code) {
  return `\u001b[${code}m${text}\u001b[0m`;
}
const green = (s) => color(s, 32);
const red = (s) => color(s, 31);
const yellow = (s) => color(s, 33);
const cyan = (s) => color(s, 36);
const gray = (s) => color(s, 90);

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (e) {
    return String(value);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[　]+/g, " ");
}

function normalizeLoose(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[【】\[\]（）()]/g, "")
    .replace(/[！!？?。、，,.\s　:：\-—]/g, "");
}

function includesAny(text, words) {
  const base = normalizeLoose(text);
  return words.some((w) => base.includes(normalizeLoose(w)));
}

function tryRequire(candidates) {
  const tried = [];

  for (const rel of candidates) {
    const abs = path.resolve(process.cwd(), rel);
    tried.push(abs);

    try {
      if (!fs.existsSync(abs) && !fs.existsSync(abs + ".js")) {
        continue;
      }
      const mod = require(abs);
      return { ok: true, mod, resolved: abs, tried };
    } catch (error) {
      tried.push(`${abs} -> ${error.message}`);
    }
  }

  return { ok: false, mod: null, resolved: null, tried };
}

// ------------------------------------------------------------
// 既存サービス探索
// ------------------------------------------------------------

const messageServiceResult = tryRequire([
  "./services/messageService",
  "./services/messageService.js",
  "./services/messageService/index",
  "./services/messageService/index.js",
  "./src/services/messageService",
  "./src/services/messageService.js",
  "./src/services/messageService/index",
  "./src/services/messageService/index.js",
]);

const promptBuilderResult = tryRequire([
  "./services/promptBuilder",
  "./services/promptBuilder.js",
  "./src/services/promptBuilder",
  "./src/services/promptBuilder.js",
  "./services/ai/buildV35Prompt",
  "./services/ai/buildV35Prompt.js",
  "./src/services/ai/buildV35Prompt",
  "./src/services/ai/buildV35Prompt.js",
]);

const historyServiceResult = tryRequire([
  "./services/historyService",
  "./services/historyService.js",
  "./src/services/historyService",
  "./src/services/historyService.js",
]);

const openaiClientResult = tryRequire([
  "./services/openaiClient",
  "./services/openaiClient.js",
  "./src/services/openaiClient",
  "./src/services/openaiClient.js",
  "./lib/openaiClient",
  "./lib/openaiClient.js",
  "./src/lib/openaiClient",
  "./src/lib/openaiClient.js",
]);

const messageServiceModule = messageServiceResult.mod;
const promptBuilderModule = promptBuilderResult.mod;
const historyServiceModule = historyServiceResult.mod;
const openaiClientModule = openaiClientResult.mod;

// ------------------------------------------------------------
// OpenAI SDK
// ------------------------------------------------------------

let OpenAI;
try {
  OpenAI = require("openai");
} catch (error) {
  console.error("❌ openai パッケージが見つかりません。");
  console.error("   npm i openai");
  process.exit(1);
}

const sdkClient = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// ------------------------------------------------------------
// 料金概算
// ※ 正確な最新単価は都度確認が必要。ここでは概算。
// ------------------------------------------------------------

const PRICE_TABLE = {
  "gpt-4o-mini": {
    inputPer1M: 0.15,
    outputPer1M: 0.60,
  },
  "gpt-4.1-mini": {
    inputPer1M: 0.40,
    outputPer1M: 1.60,
  },
  "gpt-4o": {
    inputPer1M: 2.50,
    outputPer1M: 10.00,
  },
};

function estimateUsdCost(model, usage) {
  const price = PRICE_TABLE[model];
  if (!price || !usage) return null;

  const input =
    Number(usage.input_tokens || usage.prompt_tokens || 0) / 1_000_000;
  const output =
    Number(usage.output_tokens || usage.completion_tokens || 0) / 1_000_000;

  return input * price.inputPer1M + output * price.outputPer1M;
}

// ------------------------------------------------------------
// 会話コアを叩くアダプタ
// ------------------------------------------------------------

function getCallableFunction(moduleObj, names) {
  if (!moduleObj) return null;

  for (const name of names) {
    if (typeof moduleObj?.[name] === "function") {
      return moduleObj[name].bind(moduleObj);
    }
  }

  if (typeof moduleObj === "function") {
    return moduleObj;
  }

  if (typeof moduleObj?.default === "function") {
    return moduleObj.default.bind(moduleObj);
  }

  return null;
}

/**
 * messageService がある場合に優先利用
 * repo差異に備えて複数の呼び出し形を試す
 */
const messageServiceFn = getCallableFunction(messageServiceModule, [
  "handleUserMessage",
  "processUserMessage",
  "handleMessage",
  "runMessageService",
  "execute",
]);

/**
 * promptBuilder がある場合に使う
 */
const promptBuilderFn = getCallableFunction(promptBuilderModule, [
  "buildPrompt",
  "buildV35Prompt",
  "buildMessages",
  "createPrompt",
]);

/**
 * historyService がある場合に使う
 */
const saveHistoryFn = getCallableFunction(historyServiceModule, [
  "saveConversationHistory",
  "appendConversationHistory",
  "saveHistory",
  "addHistory",
]);

const getHistoryFn = getCallableFunction(historyServiceModule, [
  "getConversationHistory",
  "readConversationHistory",
  "findConversationHistory",
  "listConversationHistory",
]);

/**
 * openaiClient wrapper がある場合
 */
const openaiClientFn = getCallableFunction(openaiClientModule, [
  "createResponse",
  "callOpenAI",
  "generateResponse",
  "runOpenAI",
]);

function extractTextFromOpenAIResponse(resp) {
  if (!resp) return "";

  if (typeof resp.output_text === "string" && resp.output_text.trim()) {
    return resp.output_text.trim();
  }

  if (Array.isArray(resp.output)) {
    const texts = [];

    for (const item of resp.output) {
      if (item?.type === "message" && Array.isArray(item?.content)) {
        for (const c of item.content) {
          if (c?.type === "output_text" && c?.text) {
            texts.push(c.text);
          }
        }
      }
    }

    const joined = texts.join("\n").trim();
    if (joined) return joined;
  }

  if (typeof resp.text === "string" && resp.text.trim()) {
    return resp.text.trim();
  }

  return "";
}

async function callOpenAIResponsesAPI(messages, meta = {}) {
  const input = messages.map((m) => ({
    role: m.role,
    content: [{ type: "input_text", text: String(m.content || "") }],
  }));

  const resp = await sdkClient.responses.create({
    model: OPENAI_MODEL,
    input,
  });

  return {
    ok: true,
    source: "openai-sdk-direct",
    text: extractTextFromOpenAIResponse(resp),
    raw: resp,
    usage: resp.usage || null,
    meta,
  };
}

function toSimpleMessages(history, userMessage) {
  const messages = [];

  messages.push({
    role: "system",
    content:
      "あなたは栄一ツールの会話評価用AIです。回答は簡潔・自然・実用重視。会話の流れを優先し、文脈が続いている場合は直前テーマを引き継いでください。テーマが切れた場合のみ自然に離れてください。必要なら返答末尾に現在テーマを短く示してください。",
  });

  for (const item of history) {
    if (item.role === "user" || item.role === "assistant") {
      messages.push({
        role: item.role,
        content: String(item.content || ""),
      });
    }
  }

  messages.push({
    role: "user",
    content: userMessage,
  });

  return messages;
}

/**
 * 会話1ターン実行
 */
async function runOneTurn({
  userId,
  botId,
  userMessage,
  memoryHistory,
}) {
  // 1) 既存 messageService を最優先
  if (messageServiceFn) {
    const trialPayloads = [
      {
        userId,
        botId,
        userMessage,
        text: userMessage,
        messageText: userMessage,
        replyToken: null,
        sourceType: "local_test",
        testMode: true,
        skipLineReply: true,
        skipLinePush: true,
      },
      {
        userId,
        botId,
        text: userMessage,
        sourceType: "local_test",
        testMode: true,
        skipLineReply: true,
        skipLinePush: true,
      },
      {
        userMessage,
        text: userMessage,
        testMode: true,
      },
    ];

    for (const payload of trialPayloads) {
      try {
        const result = await messageServiceFn(payload);

        const aiReply =
          result?.data?.aiReply ||
          result?.data?.replyText ||
          result?.data?.reply ||
          result?.aiReply ||
          result?.replyText ||
          result?.reply ||
          result?.message ||
          "";

        if (aiReply) {
          return {
            ok: true,
            source: "messageService",
            text: String(aiReply).trim(),
            raw: result,
            usage:
              result?.data?.usage ||
              result?.usage ||
              result?.data?.openaiUsage ||
              null,
          };
        }
      } catch (error) {
        // 次候補へ
      }
    }
  }

  // 2) promptBuilder + openaiClient wrapper
  if (promptBuilderFn) {
    try {
      const built = await promptBuilderFn({
        userId,
        botId,
        userMessage,
        text: userMessage,
        history: memoryHistory,
        sourceType: "local_test",
        testMode: true,
      });

      const messages =
        built?.messages ||
        built?.data?.messages ||
        built?.promptMessages ||
        built?.data?.promptMessages;

      if (Array.isArray(messages) && messages.length > 0) {
        if (openaiClientFn) {
          try {
            const resp = await openaiClientFn({
              model: OPENAI_MODEL,
              messages,
              testMode: true,
            });

            const text =
              resp?.data?.aiReply ||
              resp?.data?.replyText ||
              resp?.output_text ||
              resp?.text ||
              extractTextFromOpenAIResponse(resp) ||
              "";

            if (text) {
              return {
                ok: true,
                source: "promptBuilder+openaiClient",
                text: String(text).trim(),
                raw: resp,
                usage:
                  resp?.usage ||
                  resp?.data?.usage ||
                  resp?.response?.usage ||
                  null,
              };
            }
          } catch (error) {
            // direct SDK fallback
          }
        }

        return await callOpenAIResponsesAPI(messages, {
          builtBy: "promptBuilder",
        });
      }
    } catch (error) {
      // fallback
    }
  }

  // 3) history memory + direct OpenAI
  const messages = toSimpleMessages(memoryHistory, userMessage);
  return await callOpenAIResponsesAPI(messages, {
    builtBy: "local-simple-history",
  });
}

// ------------------------------------------------------------
// テストケース
// ------------------------------------------------------------

const FLOWS = [
  {
    id: "FLOW01",
    title: "金井テーマ継続",
    steps: [
      {
        user: "スーツを作りたい",
        expectKeywordsAny: ["スーツ", "オーダースーツ", "採寸", "ご相談", "金井"],
        expectThemeAny: ["スーツ金井", "金井"],
      },
      {
        user: "駐車場は？",
        expectThemeAny: ["スーツ金井", "金井"],
      },
      {
        user: "納期は？",
        expectThemeAny: ["スーツ金井", "金井"],
      },
    ],
  },
  {
    id: "FLOW02",
    title: "法律テーマ継続",
    steps: [
      {
        user: "法律相談をしたい",
        expectKeywordsAny: ["法律", "相談", "弁護士", "池田"],
        expectThemeAny: ["法律池田", "池田"],
      },
      {
        user: "初回相談は無料？",
        expectThemeAny: ["法律池田", "池田"],
      },
      {
        user: "予約方法は？",
        expectThemeAny: ["法律池田", "池田"],
      },
    ],
  },
  {
    id: "FLOW03",
    title: "テーマ無しからAI系へ",
    steps: [
      {
        user: "AI活用を相談したい",
        expectKeywordsAny: ["AI", "活用", "業務効率", "相談", "高村"],
        expectThemeAny: ["高村AI", "AI", "takamura"],
      },
      {
        user: "導入の流れは？",
        expectThemeAny: ["高村AI", "AI", "takamura"],
      },
    ],
  },
  {
    id: "FLOW04",
    title: "テーマ解除確認",
    steps: [
      {
        user: "スーツを作りたい",
        expectThemeAny: ["スーツ金井", "金井"],
      },
      {
        user: "駐車場は？",
        expectThemeAny: ["スーツ金井", "金井"],
      },
      {
        user: "今日は天気どう？",
        expectNotThemeAny: ["スーツ金井", "金井"],
      },
    ],
  },
  {
    id: "FLOW05",
    title: "相続テーマ継続",
    steps: [
      {
        user: "相続の相談をしたい",
        expectKeywordsAny: ["相続", "相談", "遺言", "尾形"],
        expectThemeAny: ["相続", "尾形", "ogata"],
      },
      {
        user: "家族信託も聞けますか？",
        expectThemeAny: ["相続", "尾形", "ogata"],
      },
    ],
  },
  {
    id: "FLOW06",
    title: "ワインテーマ継続",
    steps: [
      {
        user: "ワインを楽しみたい",
        expectKeywordsAny: ["ワイン", "グラス", "小澤", "ozawa"],
        expectThemeAny: ["ワイン", "小澤", "ozawa"],
      },
      {
        user: "初心者でも大丈夫？",
        expectThemeAny: ["ワイン", "小澤", "ozawa"],
      },
    ],
  },
];

// ------------------------------------------------------------
// 判定
// ------------------------------------------------------------

function evaluateReply(reply, rule) {
  const reasons = [];
  let pass = true;

  if (Array.isArray(rule.expectKeywordsAny) && rule.expectKeywordsAny.length > 0) {
    const hit = includesAny(reply, rule.expectKeywordsAny);
    if (!hit) {
      pass = false;
      reasons.push(`期待語なし: ${rule.expectKeywordsAny.join(" / ")}`);
    }
  }

  if (Array.isArray(rule.expectThemeAny) && rule.expectThemeAny.length > 0) {
    const hit = includesAny(reply, rule.expectThemeAny);
    if (!hit) {
      pass = false;
      reasons.push(`期待テーマなし: ${rule.expectThemeAny.join(" / ")}`);
    }
  }

  if (Array.isArray(rule.expectNotThemeAny) && rule.expectNotThemeAny.length > 0) {
    const hit = includesAny(reply, rule.expectNotThemeAny);
    if (hit) {
      pass = false;
      reasons.push(`不要テーマ混入: ${rule.expectNotThemeAny.join(" / ")}`);
    }
  }

  return {
    pass,
    reasons,
  };
}

// ------------------------------------------------------------
// 実行
// ------------------------------------------------------------

async function main() {
  console.log(cyan("============================================================"));
  console.log(cyan(" V5.34 / V3.54 系 ローカル総合テスト（LINEなし・OpenAI込み）"));
  console.log(cyan("============================================================"));
  console.log(gray(`OPENAI_MODEL: ${OPENAI_MODEL}`));
  console.log(gray(`messageService: ${messageServiceResult.ok ? "FOUND" : "NOT FOUND"}`));
  console.log(gray(`promptBuilder : ${promptBuilderResult.ok ? "FOUND" : "NOT FOUND"}`));
  console.log(gray(`historyService: ${historyServiceResult.ok ? "FOUND" : "NOT FOUND"}`));
  console.log(gray(`openaiClient  : ${openaiClientResult.ok ? "FOUND" : "NOT FOUND"}`));
  console.log("");

  const summary = {
    totalSteps: 0,
    passedSteps: 0,
    failedSteps: 0,
    flowResults: [],
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    },
    costUsd: 0,
    costJpy: 0,
  };

  const sharedUserId = "local-test-user-001";
  const sharedBotId = "local-test-bot-001";

  for (const flow of FLOWS) {
    console.log(cyan(`\n--- ${flow.id}: ${flow.title} ---`));

    const memoryHistory = [];
    const flowResult = {
      id: flow.id,
      title: flow.title,
      steps: [],
    };

    for (let i = 0; i < flow.steps.length; i++) {
      const step = flow.steps[i];
      summary.totalSteps += 1;

      console.log(yellow(`\n[USER ${i + 1}] ${step.user}`));

      const startedAt = Date.now();

      let result;
      try {
        result = await runOneTurn({
          userId: sharedUserId,
          botId: sharedBotId,
          userMessage: step.user,
          memoryHistory,
        });
      } catch (error) {
        result = {
          ok: false,
          text: "",
          source: "exception",
          error,
          usage: null,
        };
      }

      const elapsedMs = Date.now() - startedAt;
      const reply = normalize(result?.text || "");

      console.log(gray(`source: ${result?.source || "unknown"} / ${elapsedMs}ms`));
      if (reply) {
        console.log(green(`[AI] ${reply}`));
      } else {
        console.log(red("[AI] 返答取得失敗"));
      }

      const judged = evaluateReply(reply, step);

      if (judged.pass) {
        summary.passedSteps += 1;
        console.log(green(`PASS`));
      } else {
        summary.failedSteps += 1;
        console.log(red(`FAIL: ${judged.reasons.join(" | ")}`));
      }

      const usage = result?.usage || {};
      const inputTokens = Number(usage.input_tokens || usage.prompt_tokens || 0);
      const outputTokens = Number(usage.output_tokens || usage.completion_tokens || 0);
      const totalTokens =
        Number(usage.total_tokens || inputTokens + outputTokens || 0);

      summary.usage.input_tokens += inputTokens;
      summary.usage.output_tokens += outputTokens;
      summary.usage.total_tokens += totalTokens;

      const stepUsd = estimateUsdCost(OPENAI_MODEL, {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      });

      if (typeof stepUsd === "number") {
        summary.costUsd += stepUsd;
      }

      flowResult.steps.push({
        user: step.user,
        reply,
        pass: judged.pass,
        reasons: judged.reasons,
        elapsedMs,
        source: result?.source || "unknown",
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: totalTokens,
        },
      });

      // 次ターン用 memoryHistory
      memoryHistory.push({ role: "user", content: step.user });
      memoryHistory.push({ role: "assistant", content: reply });

      // Sheets保存系に依存しない軽量ローカル進行
      // saveHistoryFn があれば保存も試す（失敗しても止めない）
      if (saveHistoryFn) {
        try {
          await saveHistoryFn({
            botId: sharedBotId,
            userId: sharedUserId,
            timestamp: new Date().toISOString(),
            userMessage: step.user,
            aiReply: reply,
            sourceType: "local_test",
            manualSend: false,
          });
        } catch (error) {
          // 保存失敗は許容
        }
      }

      await sleep(300);
    }

    summary.flowResults.push(flowResult);
  }

  summary.costJpy = summary.costUsd * USDJPY;

  console.log(cyan("\n============================================================"));
  console.log(cyan(" 集計"));
  console.log(cyan("============================================================"));
  console.log(`総ステップ   : ${summary.totalSteps}`);
  console.log(green(`PASS         : ${summary.passedSteps}`));
  console.log(red(`FAIL         : ${summary.failedSteps}`));
  console.log("");
  console.log(`input_tokens : ${summary.usage.input_tokens}`);
  console.log(`output_tokens: ${summary.usage.output_tokens}`);
  console.log(`total_tokens : ${summary.usage.total_tokens}`);

  if (summary.costUsd > 0) {
    console.log(`概算USD      : $${summary.costUsd.toFixed(6)}`);
    console.log(`概算JPY      : ¥${Math.round(summary.costJpy)}`);
  } else {
    console.log(gray("概算コスト   : usage/price算出なし"));
  }

  const report = {
    executedAt: new Date().toISOString(),
    model: OPENAI_MODEL,
    moduleDetection: {
      messageService: {
        found: messageServiceResult.ok,
        resolved: messageServiceResult.resolved,
      },
      promptBuilder: {
        found: promptBuilderResult.ok,
        resolved: promptBuilderResult.resolved,
      },
      historyService: {
        found: historyServiceResult.ok,
        resolved: historyServiceResult.resolved,
      },
      openaiClient: {
        found: openaiClientResult.ok,
        resolved: openaiClientResult.resolved,
      },
    },
    summary,
  };

  const outDir = path.resolve(process.cwd(), "tmp");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, "test-v534-openai-local-report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log("");
  console.log(cyan(`レポート保存: ${outPath}`));

  if (summary.failedSteps > 0) {
    console.log(red("\nNGあり。現コミットに改善余地があります。"));
    process.exitCode = 1;
  } else {
    console.log(green("\n全ステップPASS。現コミットはこの観点では良好です。"));
  }
}

main().catch((error) => {
  console.error(red("致命エラー"));
  console.error(error);
  process.exit(1);
});