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
 * - 実AIが companyCandidates / currentCompanyId を見て企業判定するか確認
 * - parseV35Response の補完ロジックが効くか確認
 * - V3.53 の弱点（誤爆 / 文脈落ち / テーマ無し復帰失敗）を洗い出す
 * - usage を拾って、1件ごと・全体のコストを日本円で可視化する
 *
 * 使い方:
 *   node tmp/testV353.js
 *
 * 前提:
 * - .env に OPENAI_API_KEY が入っていること
 * - OPENAI_MODEL は未設定なら gpt-4o-mini
 * - services/v35 配下の各モジュールが存在すること
 *
 * 任意ENV:
 * - USDJPY=150
 *   未設定なら 150 円で計算
 */

const { collectV35Context } = require("../services/v35/collectV35Context");
const { buildV35Prompt } = require("../services/v35/buildV35Prompt");
const { parseV35Response } = require("../services/v35/parseV35Response");
const { applyV35Actions } = require("../services/v35/applyV35Actions");

const MODEL = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
const USDJPY = Number(process.env.USDJPY || 150);

/**
 * 料金表（USD / 1M tokens）
 *
 * 必要ならここを更新
 */
const MODEL_PRICING_USD_PER_1M = {
  "gpt-4o-mini": {
    input: 0.15,
    output: 0.6,
  },
  "gpt-4o": {
    input: 2.5,
    output: 10.0,
  },
};

function getPricing(model) {
  return (
    MODEL_PRICING_USD_PER_1M[model] || {
      input: 0.15,
      output: 0.6,
    }
  );
}

/**
 * 実AI呼び出し
 */
async function callRealAI({ systemPrompt, userPrompt }) {
  const response = await openai.chat.completions.create({
    model: MODEL,
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

  const aiRawText = String(response?.choices?.[0]?.message?.content || "").trim();
  const usage = response?.usage || null;

  return {
    aiRawText,
    usage,
    rawResponse: response,
  };
}

/**
 * 表示補助
 */
function printDivider(title = "") {
  console.log("\n==================================================");
  console.log(title);
  console.log("==================================================");
}

function shortText(value, max = 200) {
  const text = String(value || "");
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function normalizeExpected(value) {
  return String(value || "").trim();
}

function yen(n) {
  return `${Number(n || 0).toFixed(4)}円`;
}

function usd(n) {
  return `$${Number(n || 0).toFixed(8)}`;
}

/**
 * usage 互換吸収
 * SDK差分で input/output か prompt/completion か揺れることがあるため吸収
 */
function extractUsage(usage) {
  const inputTokens =
    Number(
      usage?.prompt_tokens ??
        usage?.input_tokens ??
        0
    ) || 0;

  const outputTokens =
    Number(
      usage?.completion_tokens ??
        usage?.output_tokens ??
        0
    ) || 0;

  const totalTokens =
    Number(
      usage?.total_tokens ??
        inputTokens + outputTokens
    ) || inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

/**
 * コスト計算
 */
function calculateCostFromUsage(usage, model) {
  const { inputTokens, outputTokens, totalTokens } = extractUsage(usage);
  const pricing = getPricing(model);

  const inputUsd = (inputTokens / 1000000) * pricing.input;
  const outputUsd = (outputTokens / 1000000) * pricing.output;
  const totalUsd = inputUsd + outputUsd;

  const inputJpy = inputUsd * USDJPY;
  const outputJpy = outputUsd * USDJPY;
  const totalJpy = totalUsd * USDJPY;

  return {
    model,
    usdJpy: USDJPY,
    pricing,
    inputTokens,
    outputTokens,
    totalTokens,
    inputUsd,
    outputUsd,
    totalUsd,
    inputJpy,
    outputJpy,
    totalJpy,
  };
}

/**
 * テスト判定
 *
 * expectedCompanyId:
 * - undefined のとき: 判定しない（参考表示のみ）
 * - "" のとき: company無しを期待
 * - "kanai_suits" のとき: その company を期待
 */
function judgeCompany({ expectedCompanyId, actualCompanyId }) {
  if (typeof expectedCompanyId === "undefined") {
    return {
      judged: false,
      pass: null,
      reason: "expectedCompanyId 未指定のため参考テスト",
    };
  }

  const expected = normalizeExpected(expectedCompanyId);
  const actual = normalizeExpected(actualCompanyId);

  if (expected === actual) {
    return {
      judged: true,
      pass: true,
      reason: "expectedCompanyId と一致",
    };
  }

  return {
    judged: true,
    pass: false,
    reason: `expected="${expected}" actual="${actual}"`,
  };
}

/**
 * 共通テスト処理
 */
async function runTest(test) {
  const {
    label,
    userMessage,
    history = [],
    expectedCompanyId,
    note = "",
  } = test;

  printDivider(`TEST: ${label}`);

  if (note) {
    console.log("note:", note);
  }

  console.log("userMessage:", userMessage);
  console.log("history:", JSON.stringify(history, null, 2));

  try {
    /**
     * ① collect
     */
    const ctxRes = await collectV35Context({
      userMessage,
      conversationHistory: history,
    });

    console.log("\n[1] collect");
    console.log("ctxRes.success:", ctxRes?.success);
    console.log("ctxRes.message:", ctxRes?.message);

    if (!ctxRes?.success) {
      console.log("collect failed");
      return {
        label,
        userMessage,
        success: false,
        phase: "collect",
        pass: false,
        judged: true,
        actualCompanyId: "",
        expectedCompanyId: normalizeExpected(expectedCompanyId),
        replyText: "",
        reason: "collect failed",
        cost: calculateCostFromUsage(null, MODEL),
      };
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

    console.log("\n[2] buildPrompt");
    console.log("promptRes.success:", promptRes?.success);
    console.log("promptRes.message:", promptRes?.message);

    if (!promptRes?.success) {
      console.log("buildV35Prompt failed");
      return {
        label,
        userMessage,
        success: false,
        phase: "buildPrompt",
        pass: false,
        judged: true,
        actualCompanyId: "",
        expectedCompanyId: normalizeExpected(expectedCompanyId),
        replyText: "",
        reason: "buildV35Prompt failed",
        cost: calculateCostFromUsage(null, MODEL),
      };
    }

    const systemPrompt = promptRes.data?.systemPrompt || "";
    const userPrompt = promptRes.data?.userPrompt || "";

    console.log("\n--- systemPrompt (head) ---");
    console.log(shortText(systemPrompt, 1200));

    console.log("\n--- userPrompt (head) ---");
    console.log(shortText(userPrompt, 1200));

    /**
     * ③ 実AI呼び出し
     */
    console.log("\n[3] callRealAI");
    const aiRes = await callRealAI({
      systemPrompt,
      userPrompt,
    });

    const aiRawText = aiRes.aiRawText;
    const usage = aiRes.usage;
    const cost = calculateCostFromUsage(usage, MODEL);

    console.log("\n--- AI RAW ---");
    console.log(aiRawText);

    console.log("\n--- usage ---");
    console.log("inputTokens :", cost.inputTokens);
    console.log("outputTokens:", cost.outputTokens);
    console.log("totalTokens :", cost.totalTokens);

    console.log("\n--- cost ---");
    console.log("model       :", MODEL);
    console.log("usdJpy      :", USDJPY);
    console.log("inputUsd    :", usd(cost.inputUsd));
    console.log("outputUsd   :", usd(cost.outputUsd));
    console.log("totalUsd    :", usd(cost.totalUsd));
    console.log("inputJpy    :", yen(cost.inputJpy));
    console.log("outputJpy   :", yen(cost.outputJpy));
    console.log("totalJpy    :", yen(cost.totalJpy));

    /**
     * ④ parse
     */
    console.log("\n[4] parse");
    const parsedRes = parseV35Response({
      aiRawText,
      context,
    });

    console.log("parsedRes.success:", parsedRes?.success);
    console.log("parsedRes.message:", parsedRes?.message);

    if (!parsedRes?.success) {
      console.log("parse failed");
      return {
        label,
        userMessage,
        success: false,
        phase: "parse",
        pass: false,
        judged: true,
        actualCompanyId: "",
        expectedCompanyId: normalizeExpected(expectedCompanyId),
        replyText: "",
        reason: "parse failed",
        cost,
      };
    }

    const parsed = parsedRes.data?.parsed || {};

    console.log("parsed.topicLabel:", parsed.topicLabel);
    console.log("parsed.matchedCompanyId:", parsed.matchedCompanyId);
    console.log("parsed.replyText:", parsed.replyText);

    /**
     * ⑤ apply
     */
    console.log("\n[5] apply");
    const finalRes = await applyV35Actions({
      parsed,
      userMessage,
    });

    console.log("finalRes.success:", finalRes?.success);
    console.log("finalRes.message:", finalRes?.message);

    const finalMatchedCompanyId = String(
      finalRes?.data?.matchedCompanyId ||
        parsed?.matchedCompanyId ||
        ""
    ).trim();

    const replyText = String(finalRes?.data?.replyText || "").trim();

    console.log("\n--- final summary ---");
    console.log("currentCompanyId:", context.currentCompanyId);
    console.log("parsed.topicLabel:", parsed.topicLabel);
    console.log("parsed.matchedCompanyId:", parsed.matchedCompanyId);
    console.log("final.matchedCompanyId:", finalMatchedCompanyId);
    console.log("replyText:", replyText);

    const judge = judgeCompany({
      expectedCompanyId,
      actualCompanyId: finalMatchedCompanyId,
    });

    if (judge.judged) {
      console.log("\n--- judge ---");
      console.log("expectedCompanyId:", normalizeExpected(expectedCompanyId));
      console.log("actualCompanyId:", finalMatchedCompanyId);
      console.log("RESULT:", judge.pass ? "PASS" : "NG");
      console.log("reason:", judge.reason);
    } else {
      console.log("\n--- judge ---");
      console.log("RESULT: SKIP");
      console.log("reason:", judge.reason);
    }

    return {
      label,
      userMessage,
      success: true,
      phase: "done",
      pass: judge.pass,
      judged: judge.judged,
      actualCompanyId: finalMatchedCompanyId,
      expectedCompanyId: normalizeExpected(expectedCompanyId),
      replyText,
      reason: judge.reason,
      cost,
    };
  } catch (error) {
    console.error("runTest failed:", error);

    return {
      label,
      userMessage,
      success: false,
      phase: "exception",
      pass: false,
      judged: true,
      actualCompanyId: "",
      expectedCompanyId: normalizeExpected(expectedCompanyId),
      replyText: "",
      reason: `exception: ${error.message}`,
      cost: calculateCostFromUsage(null, MODEL),
    };
  }
}

/**
 * テスト一覧
 *
 * 注意:
 * - 会社IDは、現時点で比較的確度の高いものだけ使用
 * - kanai_suits
 * - ikeda_legal
 *
 * 「テーマ無し」を期待するケースは expectedCompanyId: ""
 */
function buildTests() {
  return [
    // ==================================================
    // A. 単発：直球で company 判定してほしい
    // ==================================================
    {
      label: "A01-単発-スーツ直球",
      userMessage: "スーツを作りたい",
      history: [],
      expectedCompanyId: "kanai_suits",
    },
    {
      label: "A02-単発-法律直球",
      userMessage: "法律相談したいです",
      history: [],
      expectedCompanyId: "ikeda_legal",
    },
    {
      label: "A03-単発-弁護士直球",
      userMessage: "弁護士さんに相談したいです",
      history: [],
      expectedCompanyId: "ikeda_legal",
    },

    // ==================================================
    // B. 単発：少しズレた言い方
    // ==================================================
    {
      label: "B01-単発-スーツ類義語-礼服",
      userMessage: "礼服を仕立てたい",
      history: [],
      expectedCompanyId: "kanai_suits",
    },
    {
      label: "B02-単発-スーツ類義語-オーダー",
      userMessage: "オーダーの服を作りたい",
      history: [],
      expectedCompanyId: "kanai_suits",
    },
    {
      label: "B03-単発-法律類義語-トラブル",
      userMessage: "法的なトラブルを相談したい",
      history: [],
      expectedCompanyId: "ikeda_legal",
    },
    {
      label: "B04-単発-法律類義語-相続",
      userMessage: "相続のことで困っています",
      history: [],
      expectedCompanyId: "ikeda_legal",
    },

    // ==================================================
    // C. 単発：曖昧語。ここで暴発しないか
    // ==================================================
    {
      label: "C01-単発-曖昧-相談",
      userMessage: "相談したい",
      history: [],
      expectedCompanyId: "",
      note: "単発で会社が無い状態では、勝手に company 決め打ちしないか確認",
    },
    {
      label: "C02-単発-曖昧-料金",
      userMessage: "料金は？",
      history: [],
      expectedCompanyId: "",
    },
    {
      label: "C03-単発-曖昧-予約",
      userMessage: "予約したいです",
      history: [],
      expectedCompanyId: "",
    },
    {
      label: "C04-単発-曖昧-場所",
      userMessage: "場所どこ？",
      history: [],
      expectedCompanyId: "",
    },
    {
      label: "C05-単発-曖昧-駐車場",
      userMessage: "駐車場ある？",
      history: [],
      expectedCompanyId: "",
    },

    // ==================================================
    // D. 会話継続：スーツ
    // ==================================================
    {
      label: "D01-継続-スーツ-納期",
      userMessage: "納期は？",
      history: [
        {
          matchedCompanyId: "kanai_suits",
          matchedCompanyName: "スーツ金井",
        },
      ],
      expectedCompanyId: "kanai_suits",
    },
    {
      label: "D02-継続-スーツ-料金",
      userMessage: "いくらくらい？",
      history: [
        {
          matchedCompanyId: "kanai_suits",
          matchedCompanyName: "スーツ金井",
        },
      ],
      expectedCompanyId: "kanai_suits",
    },
    {
      label: "D03-継続-スーツ-駐車場",
      userMessage: "駐車場ある？",
      history: [
        {
          matchedCompanyId: "kanai_suits",
          matchedCompanyName: "スーツ金井",
        },
      ],
      expectedCompanyId: "kanai_suits",
    },
    {
      label: "D04-継続-スーツ-予約",
      userMessage: "予約は必要？",
      history: [
        {
          matchedCompanyId: "kanai_suits",
          matchedCompanyName: "スーツ金井",
        },
      ],
      expectedCompanyId: "kanai_suits",
    },
    {
      label: "D05-継続-スーツ-複数履歴",
      userMessage: "生地は選べますか？",
      history: [
        {
          matchedCompanyId: "kanai_suits",
          matchedCompanyName: "スーツ金井",
        },
        {
          matchedCompanyId: "kanai_suits",
          matchedCompanyName: "スーツ金井",
        },
        {
          matchedCompanyId: "kanai_suits",
          matchedCompanyName: "スーツ金井",
        },
      ],
      expectedCompanyId: "kanai_suits",
    },

    // ==================================================
    // E. 会話継続：法律
    // ==================================================
    {
      label: "E01-継続-法律-料金",
      userMessage: "相談料はいくらですか？",
      history: [
        {
          matchedCompanyId: "ikeda_legal",
          matchedCompanyName: "池田法律",
        },
      ],
      expectedCompanyId: "ikeda_legal",
    },
    {
      label: "E02-継続-法律-予約",
      userMessage: "予約したいです",
      history: [
        {
          matchedCompanyId: "ikeda_legal",
          matchedCompanyName: "池田法律",
        },
      ],
      expectedCompanyId: "ikeda_legal",
    },
    {
      label: "E03-継続-法律-場所",
      userMessage: "場所はどこですか？",
      history: [
        {
          matchedCompanyId: "ikeda_legal",
          matchedCompanyName: "池田法律",
        },
      ],
      expectedCompanyId: "ikeda_legal",
    },
    {
      label: "E04-継続-法律-複数履歴",
      userMessage: "相続も相談できますか？",
      history: [
        {
          matchedCompanyId: "ikeda_legal",
          matchedCompanyName: "池田法律",
        },
        {
          matchedCompanyId: "ikeda_legal",
          matchedCompanyName: "池田法律",
        },
      ],
      expectedCompanyId: "ikeda_legal",
    },

    // ==================================================
    // F. テーマ無しへ戻すべき
    // ==================================================
    {
      label: "F01-テーマ無し-挨拶",
      userMessage: "こんにちは",
      history: [],
      expectedCompanyId: "",
    },
    {
      label: "F02-テーマ無し-感謝",
      userMessage: "ありがとう",
      history: [],
      expectedCompanyId: "",
    },
    {
      label: "F03-テーマ無し-雑談",
      userMessage: "今日は眠いです",
      history: [],
      expectedCompanyId: "",
    },
    {
      label: "F04-テーマ無し-天気",
      userMessage: "今日の天気は？",
      history: [],
      expectedCompanyId: "",
    },
    {
      label: "F05-テーマ無し-体調",
      userMessage: "少し疲れています",
      history: [],
      expectedCompanyId: "",
    },

    // ==================================================
    // G. 継続中でもテーマ切替できるか
    // ==================================================
    {
      label: "G01-切替-スーツ中に法律",
      userMessage: "法律相談もしたいです",
      history: [
        {
          matchedCompanyId: "kanai_suits",
          matchedCompanyName: "スーツ金井",
        },
      ],
      expectedCompanyId: "ikeda_legal",
    },
    {
      label: "G02-切替-法律中にスーツ",
      userMessage: "やっぱりスーツも作りたい",
      history: [
        {
          matchedCompanyId: "ikeda_legal",
          matchedCompanyName: "池田法律",
        },
      ],
      expectedCompanyId: "kanai_suits",
    },

    // ==================================================
    // H. 誤字・口語・短文
    // ==================================================
    {
      label: "H01-誤字-スーツ",
      userMessage: "すーつつくりたい",
      history: [],
      expectedCompanyId: "kanai_suits",
    },
    {
      label: "H02-口語-法律",
      userMessage: "弁護士にちょい相談したい",
      history: [],
      expectedCompanyId: "ikeda_legal",
    },
    {
      label: "H03-超短文-駐車場単発",
      userMessage: "駐車場",
      history: [],
      expectedCompanyId: "",
    },
    {
      label: "H04-超短文-料金単発",
      userMessage: "料金",
      history: [],
      expectedCompanyId: "",
    },
    {
      label: "H05-超短文-予約単発",
      userMessage: "予約",
      history: [],
      expectedCompanyId: "",
    },

    // ==================================================
    // I. 継続下の短文
    // ==================================================
    {
      label: "I01-短文継続-スーツ-料金",
      userMessage: "料金",
      history: [
        {
          matchedCompanyId: "kanai_suits",
          matchedCompanyName: "スーツ金井",
        },
      ],
      expectedCompanyId: "kanai_suits",
    },
    {
      label: "I02-短文継続-法律-予約",
      userMessage: "予約",
      history: [
        {
          matchedCompanyId: "ikeda_legal",
          matchedCompanyName: "池田法律",
        },
      ],
      expectedCompanyId: "ikeda_legal",
    },
    {
      label: "I03-短文継続-スーツ-場所",
      userMessage: "場所",
      history: [
        {
          matchedCompanyId: "kanai_suits",
          matchedCompanyName: "スーツ金井",
        },
      ],
      expectedCompanyId: "kanai_suits",
    },
  ];
}

/**
 * 集計表示
 */
function printResults(results) {
  printDivider("FINAL REPORT");

  const total = results.length;
  const successCount = results.filter((r) => r.success).length;
  const judgedCount = results.filter((r) => r.judged).length;
  const passCount = results.filter((r) => r.judged && r.pass === true).length;
  const ngCount = results.filter((r) => r.judged && r.pass === false).length;
  const skipCount = results.filter((r) => !r.judged).length;

  console.log("total:", total);
  console.log("successCount:", successCount);
  console.log("judgedCount:", judgedCount);
  console.log("passCount:", passCount);
  console.log("ngCount:", ngCount);
  console.log("skipCount:", skipCount);

  const accuracy =
    judgedCount > 0 ? ((passCount / judgedCount) * 100).toFixed(1) : "0.0";

  console.log("judged accuracy:", `${accuracy}%`);

  const totalInputTokens = results.reduce(
    (sum, r) => sum + Number(r?.cost?.inputTokens || 0),
    0
  );
  const totalOutputTokens = results.reduce(
    (sum, r) => sum + Number(r?.cost?.outputTokens || 0),
    0
  );
  const totalTokens = results.reduce(
    (sum, r) => sum + Number(r?.cost?.totalTokens || 0),
    0
  );

  const totalInputJpy = results.reduce(
    (sum, r) => sum + Number(r?.cost?.inputJpy || 0),
    0
  );
  const totalOutputJpy = results.reduce(
    (sum, r) => sum + Number(r?.cost?.outputJpy || 0),
    0
  );
  const totalJpy = results.reduce(
    (sum, r) => sum + Number(r?.cost?.totalJpy || 0),
    0
  );

  const totalInputUsd = results.reduce(
    (sum, r) => sum + Number(r?.cost?.inputUsd || 0),
    0
  );
  const totalOutputUsd = results.reduce(
    (sum, r) => sum + Number(r?.cost?.outputUsd || 0),
    0
  );
  const totalUsd = results.reduce(
    (sum, r) => sum + Number(r?.cost?.totalUsd || 0),
    0
  );

  console.log("\n--- token totals ---");
  console.log("totalInputTokens :", totalInputTokens);
  console.log("totalOutputTokens:", totalOutputTokens);
  console.log("totalTokens      :", totalTokens);

  console.log("\n--- cost totals ---");
  console.log("model            :", MODEL);
  console.log("usdJpy           :", USDJPY);
  console.log("totalInputUsd    :", usd(totalInputUsd));
  console.log("totalOutputUsd   :", usd(totalOutputUsd));
  console.log("totalUsd         :", usd(totalUsd));
  console.log("totalInputJpy    :", yen(totalInputJpy));
  console.log("totalOutputJpy   :", yen(totalOutputJpy));
  console.log("totalJpy         :", yen(totalJpy));

  const avgJpy = total > 0 ? totalJpy / total : 0;
  const avgTokens = total > 0 ? totalTokens / total : 0;

  console.log("\n--- averages ---");
  console.log("avgTokens/test   :", avgTokens.toFixed(2));
  console.log("avgJpy/test      :", yen(avgJpy));

  printDivider("NG LIST");

  const ngList = results.filter((r) => r.judged && r.pass === false);

  if (ngList.length === 0) {
    console.log("NGなし");
  } else {
    for (const item of ngList) {
      console.log(`- ${item.label}`);
      console.log(`  userMessage: ${item.userMessage}`);
      console.log(`  expected: ${item.expectedCompanyId}`);
      console.log(`  actual  : ${item.actualCompanyId}`);
      console.log(`  reason  : ${item.reason}`);
      console.log(`  cost    : ${yen(item?.cost?.totalJpy || 0)}`);
      console.log(`  reply   : ${shortText(item.replyText, 160)}`);
      console.log("");
    }
  }

  printDivider("CSV LIKE");

  console.log("label\tuserMessage\texpected\tactual\tresult\tcostJpy\treason");
  for (const r of results) {
    const result = !r.judged ? "SKIP" : r.pass ? "PASS" : "NG";
    console.log(
      [
        r.label,
        String(r.userMessage || "").replace(/\t/g, " "),
        r.expectedCompanyId,
        r.actualCompanyId,
        result,
        Number(r?.cost?.totalJpy || 0).toFixed(4),
        String(r.reason || "").replace(/\t/g, " "),
      ].join("\t")
    );
  }
}

/**
 * 実行
 */
async function main() {
  const tests = buildTests();
  const results = [];

  printDivider("V3.53 LOCAL TEST START");
  console.log("model    :", MODEL);
  console.log("usdJpy   :", USDJPY);
  console.log("testCount:", tests.length);

  for (let i = 0; i < tests.length; i += 1) {
    const test = tests[i];
    console.log(`\n\n##### ${i + 1}/${tests.length} #####`);

    const result = await runTest(test);
    results.push(result);
  }

  printResults(results);
}

main().catch((error) => {
  console.error("main failed:", error);
  process.exitCode = 1;
});