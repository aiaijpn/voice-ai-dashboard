"use strict";

/**
 * ADR-011 不具合特定用
 * OpenAI Responses API 実送信テスト
 *
 * 目的:
 * - 本番に近い messages を実APIへ送る
 * - 400 の詳細をそのまま確認する
 * - 履歴件数や文字数が原因か切り分ける
 *
 * 実行:
 * node tmp/test-openaiClient-live.js
 *
 * 前提:
 * - OPENAI_API_KEY が環境変数に入っていること
 * - services/messageService/openaiClient.js が messages 対応済みであること
 */

require("dotenv").config();

const { callOpenAI, OPENAI_MODEL } = require("../services/messageService/openaiClient");

function printSection(title) {
  console.log("\n==================================================");
  console.log(title);
  console.log("==================================================");
}

function makeShortMessages(historyPairs = 1) {
  const messages = [
    {
      role: "system",
      content: "あなたは丁寧な日本語で対応するAIです。",
    },
  ];

  for (let i = 1; i <= historyPairs; i += 1) {
    messages.push({
      role: "user",
      content: `履歴ユーザ発言${i}: ゴルフの相談です。`,
    });

    messages.push({
      role: "assistant",
      content: `履歴AI応答${i}: 承知しました。状況を教えてください。`,
    });
  }

  messages.push({
    role: "user",
    content: "それって何が原因ですか？",
  });

  return messages;
}

function makeLongMessages(historyPairs = 6) {
  const messages = [
    {
      role: "system",
      content:
        "あなたは丁寧な日本語で対応するAIです。相手の相談意図を汲み取り、簡潔かつ親切に答えてください。",
    },
  ];

  for (let i = 1; i <= historyPairs; i += 1) {
    messages.push({
      role: "user",
      content:
        `履歴ユーザ発言${i}: ` +
        "ゴルフの相談です。ドライバーが右に曲がります。最近スコアも落ちています。" +
        "練習場ではそこそこ当たるのですが、本番になると安定しません。" +
        "体の開きが早い気もしますが、自分ではよく分かりません。",
    });

    messages.push({
      role: "assistant",
      content:
        `履歴AI応答${i}: ` +
        "ドライバーが右に曲がる場合、スライス傾向の可能性があります。" +
        "原因としては、アウトサイドイン軌道、フェースが開いたまま当たること、" +
        "グリップの弱さ、体の開きの早さなどが考えられます。" +
        "まずはアドレス、グリップ、インパクト時のフェース向きを順番に確認してください。",
    });
  }

  messages.push({
    role: "user",
    content: "それって何が原因ですか？",
  });

  return messages;
}

function makeProblemMessages() {
  return [
    {
      role: "system",
      content: "あなたは丁寧な日本語で対応するAIです。",
    },
    {
      role: "user",
      content: "",
    },
    {
      role: "assistant",
      content: "承知しました。",
    },
    {
      role: "user",
      content: "それって何が原因ですか？",
    },
  ];
}

async function runCase(label, messages) {
  printSection(`CASE: ${label}`);

  console.log("model =", OPENAI_MODEL);
  console.log("messages.length =", messages.length);
  console.log(
    "message roles =",
    messages.map((m) => m.role).join(" -> ")
  );
  console.log(
    "message content lengths =",
    messages.map((m) => String(m.content || "").length).join(", ")
  );

  const log = (...args) => console.log(...args);

  try {
    const response = await callOpenAI({
      systemPrompt: "fallback system prompt",
      text: "fallback text",
      messages,
      rid: `live_${label}`,
      log,
    });

    console.log("✅ SUCCESS");
    console.log("response.status =", response.status);
    console.log(
      "response.data keys =",
      Object.keys(response.data || {}).join(", ")
    );

    if (response.data && response.data.output_text) {
      console.log("output_text =", response.data.output_text);
    }
  } catch (error) {
    console.log("❌ FAILED");

    if (error.response) {
      console.log("status =", error.response.status);
      console.log(
        "response.data =",
        JSON.stringify(error.response.data, null, 2)
      );
    } else {
      console.log("error.message =", error.message);
    }
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is missing");
    process.exit(1);
  }

  await runCase("small", makeShortMessages(1));
  await runCase("medium", makeShortMessages(3));
  await runCase("long", makeLongMessages(6));
  await runCase("problem", makeProblemMessages());
}

main().catch((error) => {
  console.error("unexpected error:", error);
  process.exit(1);
});