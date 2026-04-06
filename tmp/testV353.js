"use strict";

require("dotenv").config();

const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * V3.53 統合テスト（ローカル / 実AI呼び出し版）
 *
 * 目的:
 * - collect → buildPrompt → OpenAI → parse → apply の連結確認
 * - 実AIが本当に companyCandidates を見て企業判定するか確認
 * - parseV35Response の補完ロジックが効くか確認
 * - 実機との差分をローカルで再現確認する
 */

const { collectV35Context } = require("../services/v35/collectV35Context");
const { buildV35Prompt } = require("../services/v35/buildV35Prompt");
const { parseV35Response } = require("../services/v35/parseV35Response");
const { applyV35Actions } = require("../services/v35/applyV35Actions");

/**
 * 実AI呼び出し
 *
 * 注意:
 * - buildV35Prompt が返した systemPrompt / userPrompt をそのまま使う
 * - temperature は低めでブレを抑える
 */
async function callRealAI({ systemPrompt, userPrompt }) {
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  return String(response?.choices?.[0]?.message?.content || "").trim();
}

/**
 * 補助表示
 */
function printDivider(title = "") {
  console.log("\n====================");
  console.log(title);
  console.log("====================");
}

/**
 * 共通テスト処理
 */
async function runTest({ label, userMessage, history }) {
  printDivider(`TEST: ${label}`);

  /**
   * ① collect
   */
  const ctxRes = await collectV35Context({
    userMessage,
    conversationHistory: history,
  });

  console.log("ctxRes.success:", ctxRes.success);
  console.log("ctxRes.message:", ctxRes.message);
  console.log("ctxRes.data:", ctxRes.data);

  if (!ctxRes.success) {
    console.log("collect failed");
    return;
  }

  const context = ctxRes.data || {};

  console.log("companyCandidates:", context.companyCandidates);
  console.log("currentCompanyId:", context.currentCompanyId);
  console.log("currentCompanyName:", context.currentCompanyName);
  console.log("isConversationContinuing:", context.isConversationContinuing);

  /**
   * ② buildPrompt
   */
  const promptRes = buildV35Prompt({
    ...context,
    userMessage,
  });

  console.log("promptRes.success:", promptRes.success);
  console.log("promptRes.message:", promptRes.message);

  if (!promptRes.success) {
    console.log("buildV35Prompt failed");
    return;
  }

  const systemPrompt = promptRes.data?.systemPrompt || "";
  const userPrompt = promptRes.data?.userPrompt || "";

  console.log("\n--- systemPrompt ---");
  console.log(systemPrompt);

  console.log("\n--- userPrompt ---");
  console.log(userPrompt);

  /**
   * ③ 実AI呼び出し
   */
  const aiRawText = await callRealAI({
    systemPrompt,
    userPrompt,
  });

  console.log("\n--- AI RAW ---");
  console.log(aiRawText);

  /**
   * ④ parse
   *
   * ここで context を渡すのが重要
   * - companyCandidates
   * - currentCompanyId
   * を使って補完・検証する
   */
  const parsedRes = parseV35Response({
    aiRawText,
    context,
  });

  console.log("\n--- parsedRes ---");
  console.log(parsedRes);

  if (!parsedRes.success) {
    console.log("parse failed");
    return;
  }

  const parsed = parsedRes.data?.parsed || {};

  /**
   * ⑤ apply
   */
  const finalRes = await applyV35Actions({
    parsed,
    userMessage,
  });

  console.log("\n--- finalRes ---");
  console.log(finalRes);

  /**
   * ⑥ 最終確認サマリ
   */
  console.log("\n--- summary ---");
  console.log("userMessage:", userMessage);
  console.log("currentCompanyId:", context.currentCompanyId);
  console.log("parsed.topicLabel:", parsed.topicLabel);
  console.log("parsed.matchedCompanyId:", parsed.matchedCompanyId);
  console.log("final.matchedCompanyId:", finalRes?.data?.matchedCompanyId);
  console.log("replyText:", finalRes?.data?.replyText);
}

/**
 * 実行
 *
 * 3ケース:
 * 1. スーツ（1件候補 → 企業採用）
 * 2. 駐車場単発（候補なし → テーマ無し）
 * 3. 駐車場継続（currentCompanyIdあり → 継続採用）
 */
async function main() {
  try {
    await runTest({
      label: "スーツ（実AI）",
      userMessage: "スーツを作りたい",
      history: [],
    });

    await runTest({
      label: "駐車場（単発 / 実AI）",
      userMessage: "駐車場ある？",
      history: [],
    });

    await runTest({
      label: "駐車場（継続 / 実AI）",
      userMessage: "駐車場ある？",
      history: [
        {
          matchedCompanyId: "kanai_suits",
          matchedCompanyName: "スーツ金井",
        },
      ],
    });
  } catch (error) {
    console.error("main failed:", error);
  }
}

main();