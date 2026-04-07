"use strict";


require("dotenv").config();

const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});



/**
 * tmp/testV354.js
 *
 * V3.54 ローカル評価テスト
 *
 * 目的:
 * - runV35() を直接叩いて V3.54 の分岐を確認する
 * - 初回マッチ / 継続会話 / テーマ無し / AIカテゴリ寄せ を見る
 * - judgeMode, topicLabel, matchedCompanyId, replyText を一覧確認する
 *
 * 実行:
 *   node tmp/testV354.js
 *
 * ログ保存:
 *   node tmp/testV354.js > tmp/testV354.log 2>&1
 */

const { runV35 } = require("../services/v35");

function printDivider(title = "") {
  console.log("\n==================================================");
  console.log(title);
  console.log("==================================================");
}

function toSafeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeExpected(value) {
  return String(value || "").trim();
}

function judgeValue(expected, actual) {
  const e = normalizeExpected(expected);
  const a = normalizeExpected(actual);
  return e === a;
}

function shortText(value, max = 200) {
  const text = String(value || "");
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

/**
 * 判定
 *
 * expectedMatchedCompanyId:
 * - undefined -> 判定しない
 * - ""        -> company無し期待
 * - "..."     -> そのcompany期待
 *
 * expectedTopicLabel:
 * - undefined -> 判定しない
 * - ""        -> 空文字期待は通常使わない
 * - "テーマ無し" など
 *
 * expectedJudgeMode:
 * - undefined -> 判定しない
 * - "skip_ai" or "ai"
 */
function judgeResult(test, result) {
  const actualData = result?.data || {};

  const actualMatchedCompanyId = toSafeString(actualData.matchedCompanyId);
  const actualTopicLabel = toSafeString(actualData.topicLabel);
  const actualJudgeMode = toSafeString(actualData.judgeMode);

  const checks = [];

  if (typeof test.expectedMatchedCompanyId !== "undefined") {
    checks.push({
      key: "matchedCompanyId",
      expected: normalizeExpected(test.expectedMatchedCompanyId),
      actual: actualMatchedCompanyId,
      pass: judgeValue(test.expectedMatchedCompanyId, actualMatchedCompanyId),
    });
  }

  if (typeof test.expectedTopicLabel !== "undefined") {
    checks.push({
      key: "topicLabel",
      expected: normalizeExpected(test.expectedTopicLabel),
      actual: actualTopicLabel,
      pass: judgeValue(test.expectedTopicLabel, actualTopicLabel),
    });
  }

  if (typeof test.expectedJudgeMode !== "undefined") {
    checks.push({
      key: "judgeMode",
      expected: normalizeExpected(test.expectedJudgeMode),
      actual: actualJudgeMode,
      pass: judgeValue(test.expectedJudgeMode, actualJudgeMode),
    });
  }

  const judged = checks.length > 0;
  const pass = judged ? checks.every((c) => c.pass) : null;

  return {
    judged,
    pass,
    checks,
    actualMatchedCompanyId,
    actualTopicLabel,
    actualJudgeMode,
  };
}

async function runTest(test, index, total) {
  printDivider(`TEST ${index + 1}/${total}: ${test.label}`);

  if (test.note) {
    console.log("note:", test.note);
  }

  console.log("userMessage:", test.userMessage);
  console.log("history:", JSON.stringify(test.history || [], null, 2));

  try {
    const result = await runV35({
      rid: `test-${String(index + 1).padStart(3, "0")}`,
      bot_id: "voice-ai-dashboard",
      userId: test.userId || `test-user-${index + 1}`,
      userMessage: test.userMessage,
      conversationHistory: Array.isArray(test.history) ? test.history : [],
    });

    console.log("\n--- RESULT RAW ---");
    console.log(JSON.stringify(result, null, 2));

    const judged = judgeResult(test, result);

    console.log("\n--- CHECK ---");
    console.log("replyText:", toSafeString(result?.data?.replyText));
    console.log("topicLabel:", judged.actualTopicLabel);
    console.log("matchedCompanyId:", judged.actualMatchedCompanyId);
    console.log("judgeMode:", judged.actualJudgeMode);
    console.log("judgeConfidence:", toSafeString(result?.data?.judgeConfidence));
    console.log("judgement:", toSafeString(result?.data?.judgement));

    if (judged.judged) {
      console.log("\n--- ASSERT ---");
      judged.checks.forEach((c) => {
        console.log(
          `${c.key}: ${c.pass ? "PASS" : "NG"} | expected="${c.expected}" actual="${c.actual}"`
        );
      });
      console.log("FINAL:", judged.pass ? "PASS" : "NG");
    } else {
      console.log("\n--- ASSERT ---");
      console.log("SKIP");
    }

    return {
      label: test.label,
      userMessage: test.userMessage,
      success: Boolean(result?.success),
      judged: judged.judged,
      pass: judged.pass,
      checks: judged.checks,
      matchedCompanyId: judged.actualMatchedCompanyId,
      topicLabel: judged.actualTopicLabel,
      judgeMode: judged.actualJudgeMode,
      replyText: toSafeString(result?.data?.replyText),
      message: toSafeString(result?.message),
    };
  } catch (error) {
    console.error("\n--- EXCEPTION ---");
    console.error(error);

    return {
      label: test.label,
      userMessage: test.userMessage,
      success: false,
      judged: true,
      pass: false,
      checks: [
        {
          key: "exception",
          expected: "",
          actual: error?.message || String(error),
          pass: false,
        },
      ],
      matchedCompanyId: "",
      topicLabel: "",
      judgeMode: "",
      replyText: "",
      message: error?.message || String(error),
    };
  }
}

function buildTests() {
  return [
    // ==================================================
    // A. 初回マッチ：スーツ
    // ==================================================
    {
      label: "A01 初回-スーツ直球",
      userMessage: "スーツを作りたい",
      history: [],
      expectedMatchedCompanyId: "kanai_suits",
      expectedTopicLabel: "スーツ金井",
      expectedJudgeMode: "skip_ai",
    },
    {
      label: "A02 初回-オーダースーツ",
      userMessage: "オーダースーツを作りたい",
      history: [],
      expectedMatchedCompanyId: "kanai_suits",
      expectedTopicLabel: "スーツ金井",
      expectedJudgeMode: "skip_ai",
    },
    {
      label: "A03 初回-礼服",
      userMessage: "礼服を仕立てたい",
      history: [],
      expectedMatchedCompanyId: "kanai_suits",
      expectedJudgeMode: "skip_ai",
    },
    {
      label: "A04 初回-誤字スーツ",
      userMessage: "すーつつくりたい",
      history: [],
      expectedMatchedCompanyId: "kanai_suits",
    },

    // ==================================================
    // B. 初回マッチ：法律
    // ==================================================
    {
      label: "B01 初回-法律相談",
      userMessage: "法律相談したいです",
      history: [],
      expectedMatchedCompanyId: "ikeda_law",
      expectedJudgeMode: "skip_ai",
    },
    {
      label: "B02 初回-弁護士",
      userMessage: "弁護士さんに相談したいです",
      history: [],
      expectedMatchedCompanyId: "ikeda_law",
    },
    {
      label: "B03 初回-法的トラブル",
      userMessage: "法的なトラブルを相談したい",
      history: [],
      expectedMatchedCompanyId: "ikeda_law",
    },

    // ==================================================
    // C. 初回マッチ：AI高村
    // ==================================================
    {
      label: "C01 初回-AI活用",
      userMessage: "AI活用のコツを教えて",
      history: [],
      expectedMatchedCompanyId: "takamura_ai",
      expectedTopicLabel: "AIサービス高村",
      expectedJudgeMode: "skip_ai",
      note: "AIカテゴリは高村へ寄せてOKという仕様前提",
    },
    {
      label: "C02 初回-AI導入相談",
      userMessage: "AIを業務に組み込みたい",
      history: [],
      expectedMatchedCompanyId: "takamura_ai",
      expectedJudgeMode: "skip_ai",
    },
    {
      label: "C03 初回-自動化相談",
      userMessage: "業務自動化の相談をしたい",
      history: [],
      expectedMatchedCompanyId: "takamura_ai",
    },

    // ==================================================
    // D. 継続会話：スーツ
    // ==================================================
    {
      label: "D01 継続-スーツ-駐車場",
      userMessage: "駐車場ある？",
      history: [
        {
          matchedCompanyId: "kanai_suit",
          matchedCompanyName: "スーツ金井",
        },
      ],
      expectedMatchedCompanyId: "kanai_suit",
      expectedJudgeMode: "skip_ai",
      note: "現状ここは topicLabel が消える可能性があるため要確認",
    },
    {
      label: "D02 継続-スーツ-料金",
      userMessage: "いくらくらい？",
      history: [
        {
          matchedCompanyId: "kanai_suit",
          matchedCompanyName: "スーツ金井",
        },
      ],
      expectedMatchedCompanyId: "kanai_suit",
      expectedJudgeMode: "skip_ai",
    },
    {
      label: "D03 継続-スーツ-予約",
      userMessage: "予約は必要？",
      history: [
        {
          matchedCompanyId: "kanai_suit",
          matchedCompanyName: "スーツ金井",
        },
      ],
      expectedMatchedCompanyId: "kanai_suit",
      expectedJudgeMode: "skip_ai",
    },

    // ==================================================
    // E. 継続会話：法律
    // ==================================================
    {
      label: "E01 継続-法律-料金",
      userMessage: "相談料はいくらですか？",
      history: [
        {
          matchedCompanyId: "ikeda_law",
          matchedCompanyName: "池田法律",
        },
      ],
      expectedMatchedCompanyId: "ikeda_law",
      expectedJudgeMode: "skip_ai",
    },
    {
      label: "E02 継続-法律-予約",
      userMessage: "予約したいです",
      history: [
        {
          matchedCompanyId: "ikeda_law",
          matchedCompanyName: "池田法律",
        },
      ],
      expectedMatchedCompanyId: "ikeda_law",
      expectedJudgeMode: "skip_ai",
    },

    // ==================================================
    // F. テーマ無し・一般
    // ==================================================
    {
      label: "F01 一般-天気",
      userMessage: "今日の天気は？",
      history: [],
      expectedMatchedCompanyId: "",
      expectedTopicLabel: "テーマ無し",
      note: "天気まで企業に寄るなら誤爆",
    },
    {
      label: "F02 一般-挨拶",
      userMessage: "こんにちは",
      history: [],
      expectedMatchedCompanyId: "",
      expectedTopicLabel: "テーマ無し",
    },
    {
      label: "F03 一般-感謝",
      userMessage: "ありがとう",
      history: [],
      expectedMatchedCompanyId: "",
      expectedTopicLabel: "テーマ無し",
    },
    {
      label: "F04 一般-体調",
      userMessage: "今日は少し疲れています",
      history: [],
      expectedMatchedCompanyId: "",
      expectedTopicLabel: "テーマ無し",
    },

    // ==================================================
    // G. 曖昧ワード
    // ==================================================
    {
      label: "G01 曖昧-相談",
      userMessage: "相談したい",
      history: [],
      expectedJudgeMode: "ai",
      note: "ここで確認質問に倒れるかを見る",
    },
    {
      label: "G02 曖昧-料金",
      userMessage: "料金は？",
      history: [],
      expectedJudgeMode: "ai",
    },
    {
      label: "G03 曖昧-場所",
      userMessage: "場所どこ？",
      history: [],
      expectedJudgeMode: "ai",
    },

    // ==================================================
    // H. 会話切替
    // ==================================================
    {
      label: "H01 切替-スーツ中に法律",
      userMessage: "法律相談もしたいです",
      history: [
        {
          matchedCompanyId: "kanai_suit",
          matchedCompanyName: "スーツ金井",
        },
      ],
      note: "現仕様でどちらを優先するか観察",
    },
    {
      label: "H02 切替-法律中にスーツ",
      userMessage: "やっぱりスーツも作りたい",
      history: [
        {
          matchedCompanyId: "ikeda_law",
          matchedCompanyName: "池田法律",
        },
      ],
      note: "切替ができるか観察",
    },
  ];
}

function printSummary(results) {
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
  console.log("judgedAccuracy:", `${accuracy}%`);

  printDivider("NG LIST");

  const ngList = results.filter((r) => r.judged && r.pass === false);

  if (ngList.length === 0) {
    console.log("NGなし");
  } else {
    ngList.forEach((r) => {
      console.log(`- ${r.label}`);
      console.log(`  userMessage: ${r.userMessage}`);
      console.log(`  matchedCompanyId: ${r.matchedCompanyId}`);
      console.log(`  topicLabel: ${r.topicLabel}`);
      console.log(`  judgeMode: ${r.judgeMode}`);
      console.log(`  replyText: ${shortText(r.replyText, 180)}`);
      r.checks.forEach((c) => {
        console.log(
          `  ${c.key}: expected="${c.expected}" actual="${c.actual}" pass=${c.pass}`
        );
      });
      console.log("");
    });
  }

  printDivider("TSV");

  console.log(
    "label\tuserMessage\tmatchedCompanyId\ttopicLabel\tjudgeMode\tresult\tmessage"
  );

  results.forEach((r) => {
    const result = !r.judged ? "SKIP" : r.pass ? "PASS" : "NG";
    console.log(
      [
        r.label,
        String(r.userMessage || "").replace(/\t/g, " "),
        String(r.matchedCompanyId || "").replace(/\t/g, " "),
        String(r.topicLabel || "").replace(/\t/g, " "),
        String(r.judgeMode || "").replace(/\t/g, " "),
        result,
        String(r.message || "").replace(/\t/g, " "),
      ].join("\t")
    );
  });
}

async function main() {
  const tests = buildTests();
  const results = [];

  printDivider("V3.54 LOCAL TEST START");
  console.log("OPENAI_MODEL:", process.env.OPENAI_MODEL || "gpt-4o-mini");
  console.log("testCount:", tests.length);

  for (let i = 0; i < tests.length; i += 1) {
    const result = await runTest(tests[i], i, tests.length);
    results.push(result);
  }

  printSummary(results);
}

main().catch((error) => {
  console.error("main failed:", error);
  process.exitCode = 1;
});