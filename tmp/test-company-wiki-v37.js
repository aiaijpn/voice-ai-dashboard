"use strict";

/**
 * tmp/test-company-wiki-v37.js
 *
 * 目的:
 * - V37 の company_wiki 動作をローカルで確認する
 * - wiki_hit / wiki_miss / clarification / 会話継続 を確認する
 *
 * 前提:
 * - services/v37/index.js が存在する
 * - company_wiki シートにテストデータが入っている
 *
 * 実行:
 * node tmp/test-company-wiki-v37.js
 * node tmp/test-company-wiki-v37.js > tmp/test-company-wiki-v37.log
 */

require("dotenv").config();

const path = require("path");

const V37_ENTRY_PATH = path.resolve(__dirname, "../services/v37");
const V37_INDEX_PATH = path.resolve(__dirname, "../services/v37/index.js");
const V37_RESOLVE_COMPANY_PATH = path.resolve(
  __dirname,
  "../services/v37/resolveCompany.js"
);
const V35_COLLECT_CONTEXT_PATH = path.resolve(
  __dirname,
  "../services/v35/collectV35Context.js"
);
const COMPANY_WIKI_SERVICE_PATH = path.resolve(
  __dirname,
  "../services/companyWikiService.js"
);
const QUESTION_STOCK_BRIDGE_PATH = path.resolve(
  __dirname,
  "../services/v37/questionStockBridge.js"
);

function clearModule(modulePath) {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_error) {
    // ignore cache miss
  }
}

function clearV37TestModules() {
  [
    V37_ENTRY_PATH,
    V37_INDEX_PATH,
    V37_RESOLVE_COMPANY_PATH,
    V35_COLLECT_CONTEXT_PATH,
    COMPANY_WIKI_SERVICE_PATH,
    QUESTION_STOCK_BRIDGE_PATH,
  ].forEach(clearModule);
}

function injectMockModule(modulePath, exportsValue) {
  require.cache[require.resolve(modulePath)] = {
    id: require.resolve(modulePath),
    filename: require.resolve(modulePath),
    loaded: true,
    exports: exportsValue,
  };
}

function loadLiveRunV37() {
  clearV37TestModules();
  return require(V37_ENTRY_PATH).runV37;
}

function loadMockRunV37(testCase) {
  clearV37TestModules();

  injectMockModule(V35_COLLECT_CONTEXT_PATH, {
    collectV35Context: async () => ({
      success: true,
      message: "mock collectV35Context success",
      data: testCase.mockContextData || {},
    }),
  });

  injectMockModule(COMPANY_WIKI_SERVICE_PATH, {
    findCompanyWikiAnswer: async () => testCase.mockWikiResult || {
      found: false,
      item: null,
    },
  });

  injectMockModule(QUESTION_STOCK_BRIDGE_PATH, {
    saveQuestionStockIfNeeded: async () => ({
      success: true,
      message: "mock saveQuestionStockIfNeeded success",
      data: null,
    }),
  });

  return require(V37_ENTRY_PATH).runV37;
}

function now() {
  return new Date().toISOString();
}

function printDivider(title = "") {
  console.log("\n==================================================");
  console.log(title);
  console.log("==================================================");
}

function printResult(label, result) {
  console.log(`\n[${label}] success:`, result?.success);
  console.log(`[${label}] message:`, result?.message || "");
  console.log(
    `[${label}] data:`,
    JSON.stringify(result?.data || null, null, 2)
  );
}

function printQuickCheck(testCase, result) {
  const data = result?.data || {};
  const replyText = String(data.replyText || "");
  const topicLabel = String(data.topicLabel || "");
  const companyId = String(data.companyId || "");
  const currentCompanyId = String(data.currentCompanyId || "");

  console.log(`\n[${testCase.name}] EXPECTATION`);
  console.log(testCase.expectation);

  console.log(`\n[${testCase.name}] QUICK CHECK`);
  console.log("- success:", Boolean(result?.success));
  console.log("- replyText exists:", Boolean(replyText));
  console.log("- topicLabel:", topicLabel);
  console.log("- companyId:", companyId);
  console.log("- currentCompanyId:", currentCompanyId);

  if (testCase.assertContains) {
    for (const text of testCase.assertContains) {
      console.log(`- reply includes "${text}":`, replyText.includes(text));
    }
  }

  if (testCase.assertNotContains) {
    for (const text of testCase.assertNotContains) {
      console.log(`- reply NOT includes "${text}":`, !replyText.includes(text));
    }
  }
}

async function runOneTest(testCase, options = {}) {
  const runV37 = options.runV37;
  const mode = options.mode || "live";

  printDivider(`START ${testCase.name}`);
  console.log("mode:", mode);
  console.log("time:", now());
  console.log("userMessage:", testCase.userMessage);

  try {
    const result = await runV37({
      rid: testCase.rid,
      bot_id: testCase.bot_id,
      userId: testCase.userId,
      userMessage: testCase.userMessage,
      conversationHistory: testCase.conversationHistory || [],
    });

    printResult(testCase.name, result);
    printQuickCheck(testCase, result);

    console.log("time:", now());
    printDivider(`END ${testCase.name}`);
    return {
      success: true,
      result,
    };
  } catch (error) {
    console.error(`\n[${testCase.name}] ERROR:`, error?.message || error);
    return {
      success: false,
      error,
    };
  }
}

function buildMockContextData(testCase) {
  switch (testCase.name) {
    case "CASE-1 wiki_hit_explicit_company":
      return {
        companyWikiCandidates: [],
        questionStockCandidates: [],
        companyCandidates: [
          {
            company_id: "kanai_suit",
            topic_label: "オーダースーツ金井",
            company_name: "オーダースーツ金井",
            score: 30,
            strongHitCount: 2,
            weakHitCount: 0,
            matchedTerms: ["スーツ金井"],
            priority: 10,
            sort_order: 1,
          },
        ],
        currentCompanyId: "",
        currentCompanyName: "",
        isConversationContinuing: false,
      };
    case "CASE-3 wiki_miss_explicit_company":
      return {
        companyWikiCandidates: [],
        questionStockCandidates: [],
        companyCandidates: [
          {
            company_id: "kanai_suit",
            topic_label: "オーダースーツ金井",
            company_name: "オーダースーツ金井",
            score: 30,
            strongHitCount: 2,
            weakHitCount: 0,
            matchedTerms: ["スーツ金井"],
            priority: 10,
            sort_order: 1,
          },
        ],
        currentCompanyId: "",
        currentCompanyName: "",
        isConversationContinuing: false,
      };
    case "CASE-4 clarification_no_company":
      return {
        companyWikiCandidates: [],
        questionStockCandidates: [],
        companyCandidates: [],
        currentCompanyId: "",
        currentCompanyName: "",
        isConversationContinuing: false,
      };
    case "CASE-5 continuation_hit_from_history":
      return {
        companyWikiCandidates: [],
        questionStockCandidates: [],
        companyCandidates: [],
        currentCompanyId: "kanai_suit",
        currentCompanyName: "オーダースーツ金井",
        isConversationContinuing: true,
      };
    case "CASE-6 continuation_miss_from_history":
      return {
        companyWikiCandidates: [],
        questionStockCandidates: [],
        companyCandidates: [],
        currentCompanyId: "kanai_suit",
        currentCompanyName: "オーダースーツ金井",
        isConversationContinuing: true,
      };
    default:
      return {
        companyWikiCandidates: [],
        questionStockCandidates: [],
        companyCandidates: [],
        currentCompanyId: "",
        currentCompanyName: "",
        isConversationContinuing: false,
      };
  }
}

function buildMockWikiResult(testCase) {
  switch (testCase.name) {
    case "CASE-1 wiki_hit_explicit_company":
    case "CASE-5 continuation_hit_from_history":
      return {
        found: true,
        item: {
          company_id: "kanai_suit",
          status: "active",
          question_pattern: "駐車場はありますか？",
          normalized_question: "駐車場はありますか？",
          answer_text: "駐車場あり",
        },
      };
    case "CASE-3 wiki_miss_explicit_company":
    case "CASE-6 continuation_miss_from_history":
      return {
        found: false,
        item: null,
      };
    default:
      return {
        found: false,
        item: null,
      };
  }
}

function addMockDataToTests(tests = []) {
  return tests.map((testCase) => ({
    ...testCase,
    mockContextData: buildMockContextData(testCase),
    mockWikiResult: buildMockWikiResult(testCase),
  }));
}

async function runLiveTests(tests = []) {
  const runV37 = loadLiveRunV37();

  for (const testCase of tests) {
    await runOneTest(testCase, {
      runV37,
      mode: "live",
    });
  }

  return {
    detectedOauthError: true,
  };
}

async function runMockTests(tests = []) {
  printDivider("MOCK TEST MODE");
  console.log("Google OAuth 依存を切り離して V37 ロジックのみ確認します。");

  for (const testCase of tests) {
    const runV37 = loadMockRunV37(testCase);
    await runOneTest(testCase, {
      runV37,
      mode: "mock",
    });
  }
}

async function main() {
  console.log("company_wiki test start:", now());

  const tests = addMockDataToTests([
    {
      name: "CASE-1 wiki_hit_explicit_company",
      rid: "wiki-test-001",
      bot_id: "voice-ai-dashboard",
      userId: "local-user-001",
      userMessage: "スーツ金井の駐車場はありますか？",
      conversationHistory: [],
      expectation:
        "company確定 + wikiヒット。company_wiki の answer_text がそのまま返ること。",
      assertContains: ["駐車場", "【"],
      assertNotContains: [
        "どの内容についてのご質問でしょうか？",
        "そのご質問についての情報は現在登録されておりません。",
      ],
    },

    {
      name: "CASE-2 wiki_hit_explicit_company_reservation",
      rid: "wiki-test-002",
      bot_id: "voice-ai-dashboard",
      userId: "local-user-002",
      userMessage: "スーツ金井は予約必要ですか？",
      conversationHistory: [],
      expectation:
        "company確定 + wikiヒット。予約に関する登録済み回答が返ること。",
      assertContains: ["予約", "【"],
      assertNotContains: [
        "どの内容についてのご質問でしょうか？",
        "そのご質問についての情報は現在登録されておりません。",
      ],
    },

    {
      name: "CASE-3 wiki_miss_explicit_company",
      rid: "wiki-test-003",
      bot_id: "voice-ai-dashboard",
      userId: "local-user-003",
      userMessage: "スーツ金井の納期短縮オプションはありますか？",
      conversationHistory: [],
      expectation:
        "company確定 + wiki未登録。未回答テンプレが返り、question_stock保存対象になること。",
      assertContains: [
        "そのご質問についての情報は現在登録されておりません。",
        "お時間いただきますが、お調べいたします。",
        "【",
      ],
      assertNotContains: ["どの内容についてのご質問でしょうか？"],
    },

    {
      name: "CASE-4 clarification_no_company",
      rid: "wiki-test-004",
      bot_id: "voice-ai-dashboard",
      userId: "local-user-004",
      userMessage: "駐車場はありますか？",
      conversationHistory: [],
      expectation:
        "company不明。clarification固定文になり、wiki回答には行かないこと。",
      assertContains: [
        "どの内容についてのご質問でしょうか？",
        "会社名やテーマをもう少しだけ具体的に教えてください。",
        "【テーマ無し】",
      ],
      assertNotContains: [
        "そのご質問についての情報は現在登録されておりません。",
      ],
    },

    {
      name: "CASE-5 continuation_hit_from_history",
      rid: "wiki-test-005",
      bot_id: "voice-ai-dashboard",
      userId: "local-user-005",
      userMessage: "駐車場はありますか？",
      conversationHistory: [
        { role: "user", content: "スーツを作りたい" },
        {
          role: "assistant",
          content: "【オーダースーツ金井】スーツのご相談ですね。",
          companyId: "kanai_suit",
        },
      ],
      expectation:
        "会話継続で金井が推定されれば、clarificationではなくwikiヒットに寄ること。",
      assertContains: ["駐車場"],
      assertNotContains: ["どの内容についてのご質問でしょうか？"],
    },

    {
      name: "CASE-6 continuation_miss_from_history",
      rid: "wiki-test-006",
      bot_id: "voice-ai-dashboard",
      userId: "local-user-006",
      userMessage: "納期短縮オプションはありますか？",
      conversationHistory: [
        { role: "user", content: "スーツを作りたい" },
        {
          role: "assistant",
          content: "【オーダースーツ金井】スーツのご相談ですね。",
          companyId: "kanai_suit",
        },
      ],
      expectation:
        "会話継続で金井が推定され、wiki未登録なら未回答テンプレに寄ること。",
      assertContains: [
        "そのご質問についての情報は現在登録されておりません。",
      ],
      assertNotContains: ["どの内容についてのご質問でしょうか？"],
    },
  ]);

  const liveSummary = await runLiveTests(tests);

  if (liveSummary.detectedOauthError) {
    await runMockTests(
      tests.filter((testCase) =>
        [
          "CASE-1 wiki_hit_explicit_company",
          "CASE-3 wiki_miss_explicit_company",
          "CASE-4 clarification_no_company",
          "CASE-5 continuation_hit_from_history",
          "CASE-6 continuation_miss_from_history",
        ].includes(testCase.name)
      )
    );
  }

  console.log("\ncompany_wiki test end:", now());
}

main().catch((error) => {
  console.error("FATAL:", error?.message || error);
  process.exit(1);
});
