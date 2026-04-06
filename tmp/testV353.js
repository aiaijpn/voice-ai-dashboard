"use strict";


require("dotenv").config();



/**
 * V3.53 統合テスト（ローカル）
 */

const { collectV35Context } = require("../services/v35/collectV35Context");
const { buildV35Prompt } = require("../services/v35/buildV35Prompt");
const { parseV35Response } = require("../services/v35/parseV35Response");
const { applyV35Actions } = require("../services/v35/applyV35Actions");

/**
 * 🔧 AIモック
 */
function mockAIResponse(caseName, context) {
  switch (caseName) {
    case "スーツ":
      return JSON.stringify({
        topicLabel: "スーツ金井",
        replyMessage: "オーダースーツの相談ですね。",
        matchedCompanyId: "kanai_suits",
        usedWiki: false,
        wikiAction: "none",
        stockAction: "none",
        judgement: "general_reply",
      });

    case "駐車場_単発":
      return JSON.stringify({
        topicLabel: "スーツ金井",
        replyMessage: "駐車場あります。",
        matchedCompanyId: "kanai_suits", // ❌誤爆
      });

    case "駐車場_継続":
      return JSON.stringify({
        topicLabel: "スーツ金井",
        replyMessage: "駐車場あります。",
        matchedCompanyId: context.currentCompanyId,
      });

    default:
      return JSON.stringify({
        topicLabel: "テーマ無し",
        replyMessage: "一般回答です",
        matchedCompanyId: "",
      });
  }
}

/**
 * 共通テスト処理
 */
async function runTest({ label, userMessage, history, caseName }) {
  console.log("\n====================");
  console.log("TEST:", label);
  console.log("====================");

  // ① collect
  const ctxRes = await collectV35Context({
    userMessage,
    conversationHistory: history,
  });

console.log("ctxRes.success:", ctxRes.success);
console.log("ctxRes.message:", ctxRes.message);
console.log("ctxRes.data:", ctxRes.data);




  const context = ctxRes.data;

  // 🔥 ここでログ出す（重要）
  console.log("companyCandidates:", context.companyCandidates);

  // ② buildPrompt（今回は使わないが通しておく）
  buildV35Prompt({
    ...context,
    userMessage,
  });

  // ③ AIモック
  const aiRawText = mockAIResponse(caseName, context);

  // ④ parse
  const parsedRes = parseV35Response({
    aiRawText,
    context,
  });

  const parsed = parsedRes.data.parsed;

  // ⑤ apply
  const finalRes = await applyV35Actions({
    parsed,
    userMessage,
  });

  console.log("userMessage:", userMessage);
  console.log("currentCompanyId:", context.currentCompanyId);
  console.log("matchedCompanyId:", finalRes.data.matchedCompanyId);
  console.log("replyText:", finalRes.data.replyText);
}

/**
 * 実行
 */
async function main() {
  await runTest({
    label: "スーツ（正常）",
    userMessage: "スーツを作りたい",
    history: [],
    caseName: "スーツ",
  });

  await runTest({
    label: "駐車場（単発 → 出るべきでない）",
    userMessage: "駐車場ある？",
    history: [],
    caseName: "駐車場_単発",
  });

  await runTest({
    label: "駐車場（継続 → 出るべき）",
    userMessage: "駐車場ある？",
    history: [
      {
        matchedCompanyId: "kanai_suits",
        matchedCompanyName: "スーツ金井",
      },
    ],
    caseName: "駐車場_継続",
  });
}

main();