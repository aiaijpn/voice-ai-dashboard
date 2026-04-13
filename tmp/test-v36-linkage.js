"use strict";

/**
 * ============================================================
 * test-v36-linkage.js
 * ============================================================
 *
 * 目的:
 * messageService → normalizeConversationHistory → runV35
 * の連結が正しく成立しているかを確認する。
 *
 * このテストでは OpenAI を呼ばない。
 * 依存をモックし、
 * 「どの入力がどこへ渡ったか」を厳密に見る。
 *
 * ------------------------------------------------------------
 * 確認ポイント
 *
 * 1. getConversationHistory の返り値が
 *    normalizeConversationHistory を通っているか
 *
 * 2. normalizeConversationHistory の結果が
 *    runV35 の conversationHistory に渡っているか
 *
 * 3. runV35 の返却値が
 *    saveConversationHistory / successData に反映されているか
 *
 * ------------------------------------------------------------
 * 実行例
 *
 * node tmp/test-v36-linkage.js
 *
 * ============================================================
 */

const path = require("path");
const assert = require("assert");

const projectRoot = path.resolve(__dirname, "..");

const messageServicePath = path.join(
  projectRoot,
  "services",
  "messageService",
  "index.js"
);

const loggerPath = path.join(projectRoot, "utils", "logger.js");
const serviceResponsePath = path.join(projectRoot, "utils", "serviceResponse.js");
const historyServicePath = path.join(projectRoot, "services", "historyService.js");
const v35Path = path.join(projectRoot, "services", "v35", "index.js");
const buildReplyPath = path.join(
  projectRoot,
  "services",
  "messageService",
  "buildReply.js"
);
const normalizePath = path.join(
  projectRoot,
  "services",
  "conversationContext",
  "normalizeConversationHistory.js"
);

/**
 * require cache を安全に差し替える
 */
function setMock(modulePath, exportsObject) {
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsObject,
  };
}

/**
 * 対象モジュールを読み直せるようにする
 */
function clearModule(modulePath) {
  delete require.cache[modulePath];
}

/**
 * 観測用
 */
const observed = {
  rawHistoryFromRepo: null,
  normalizeInput: null,
  normalizeOutput: null,
  runV35Input: null,
  saveCalls: [],
  buildReplyInput: null,
  successPayload: null,
  failPayload: null,
};

async function main() {
  console.log("=== test-v36-linkage START ===", new Date().toISOString());

  /**
   * 1. logger モック
   */
  setMock(loggerPath, {
    log: (...args) => {
      console.log("[mock log]", ...args);
    },
    error: (...args) => {
      console.log("[mock error]", ...args);
    },
  });

  /**
   * 2. serviceResponse モック
   * messageService の返り値観測用
   */
  setMock(serviceResponsePath, {
    success: (data, message) => {
      observed.successPayload = { data, message };
      return { success: true, message, data };
    },
    fail: (message, data) => {
      observed.failPayload = { message, data };
      return { success: false, message, data };
    },
  });

  /**
   * 3. historyService モック
   * 生の履歴を返す
   */
  setMock(historyServicePath, {
    getConversationHistory: async ({ botId, userId, limit }) => {
      observed.rawHistoryFromRepo = {
        botId,
        userId,
        limit,
        items: [
          {
            source_type: "user_message",
            user_message: "スーツを作りたい",
            company_id: "kanai_suit",
            company_name: "オーダースーツ金井",
            timestamp: "2026-04-13T09:00:00+09:00",
          },
          {
            source_type: "ai_reply",
            ai_reply: "【オーダースーツ金井】\n承知しました。",
            company_id: "kanai_suit",
            company_name: "オーダースーツ金井",
            timestamp: "2026-04-13T09:00:10+09:00",
          },
          {
            source_type: "user_message",
            user_message: "駐車場は？",
            company_id: "kanai_suit",
            company_name: "オーダースーツ金井",
            timestamp: "2026-04-13T09:01:00+09:00",
          },
        ],
      };

      return {
        success: true,
        message: "mock history loaded",
        data: {
          items: observed.rawHistoryFromRepo.items,
        },
      };
    },

    saveConversationHistory: async (payload) => {
      observed.saveCalls.push(payload);
      return {
        success: true,
        message: "mock save ok",
        data: payload,
      };
    },
  });

  /**
   * 4. normalizeConversationHistory モック
   * 「整形済み履歴」を明示的に返す
   */
  setMock(normalizePath, {
    normalizeConversationHistory: (items) => {
      observed.normalizeInput = items;

      const normalized = [
        {
          role: "user",
          text: "スーツを作りたい",
          companyId: "kanai_suit",
          companyName: "オーダースーツ金井",
          sourceType: "user_message",
          timestamp: "2026-04-13T09:00:00+09:00",
        },
        {
          role: "assistant",
          text: "【オーダースーツ金井】\n承知しました。",
          companyId: "kanai_suit",
          companyName: "オーダースーツ金井",
          sourceType: "ai_reply",
          timestamp: "2026-04-13T09:00:10+09:00",
        },
        {
          role: "user",
          text: "駐車場は？",
          companyId: "kanai_suit",
          companyName: "オーダースーツ金井",
          sourceType: "user_message",
          timestamp: "2026-04-13T09:01:00+09:00",
        },
      ];

      observed.normalizeOutput = normalized;
      return normalized;
    },
  });

  /**
   * 5. V35 モック
   * normalize 済み履歴が入ってくるか観測する
   */
  setMock(v35Path, {
    runV35: async (input) => {
      observed.runV35Input = input;

      return {
        success: true,
        message: "mock v35 ok",
        data: {
          replyText: "【オーダースーツ金井】\n駐車場はございません。",
          topicLabel: "オーダースーツ金井",
          companyId: "kanai_suit",
          matchedCompanyId: "kanai_suit",
          currentCompanyId: "kanai_suit",
          isConversationContinuing: true,
        },
      };
    },
  });

  /**
   * 6. buildReply モック
   * V35 出力がそのまま入るか観測する
   */
  setMock(buildReplyPath, {
    buildProcessMessageSuccessData: ({
      finalReply,
      parsed,
      userId,
      bot_id,
      rid,
    }) => {
      observed.buildReplyInput = {
        finalReply,
        parsed,
        userId,
        bot_id,
        rid,
      };

      return {
        replyText: finalReply,
        topicLabel: parsed.topicLabel,
        companyId: parsed.companyId,
        matchedCompanyId: parsed.matchedCompanyId,
        currentCompanyId: parsed.currentCompanyId || "",
        userId,
        bot_id,
        rid,
      };
    },
  });

  /**
   * 7. messageService を読み直す
   */
  clearModule(messageServicePath);
  const { processMessage } = require(messageServicePath);

  /**
   * 8. 実行
   */
  const result = await processMessage({
    rid: "RID-LINKAGE-001",
    bot_id: "voice-ai-dashboard",
    userId: "user-001",
    text: "駐車場は？",
  });

  /**
   * ============================================================
   * 検証
   * ============================================================
   */

  // A. 正常終了
  assert.strictEqual(result.success, true, "processMessage should succeed");

  // B. 生履歴が normalize に渡っている
  assert.deepStrictEqual(
    observed.normalizeInput,
    observed.rawHistoryFromRepo.items,
    "raw history should be passed into normalizeConversationHistory"
  );

  // C. normalize 済み履歴が runV35 に渡っている
  assert.deepStrictEqual(
    observed.runV35Input.conversationHistory,
    observed.normalizeOutput,
    "normalized conversationHistory should be passed into runV35"
  );

  // D. runV35 の入力に userMessage が正しく入る
  assert.strictEqual(
    observed.runV35Input.userMessage,
    "駐車場は？",
    "runV35 should receive current user message"
  );

  // E. 保存が2回呼ばれる（user_message / ai_reply）
  assert.strictEqual(
    observed.saveCalls.length,
    2,
    "saveConversationHistory should be called twice"
  );

  assert.strictEqual(
    observed.saveCalls[0].sourceType,
    "user_message",
    "first save should be user_message"
  );
  assert.strictEqual(
    observed.saveCalls[1].sourceType,
    "ai_reply",
    "second save should be ai_reply"
  );

  // F. 保存時の companyId が V35 最終結果を使っている
  assert.strictEqual(
    observed.saveCalls[0].companyId,
    "kanai_suit",
    "user_message save should use final companyId"
  );
  assert.strictEqual(
    observed.saveCalls[1].companyId,
    "kanai_suit",
    "ai_reply save should use final companyId"
  );

  // G. buildReply に V35 最終結果がそのまま入る
  assert.strictEqual(
    observed.buildReplyInput.finalReply,
    "【オーダースーツ金井】\n駐車場はございません。",
    "finalReply should come from runV35 replyText"
  );
  assert.strictEqual(
    observed.buildReplyInput.parsed.topicLabel,
    "オーダースーツ金井",
    "topicLabel should come from runV35"
  );
  assert.strictEqual(
    observed.buildReplyInput.parsed.companyId,
    "kanai_suit",
    "companyId should come from runV35"
  );
  assert.strictEqual(
    observed.buildReplyInput.parsed.matchedCompanyId,
    "kanai_suit",
    "matchedCompanyId should come from runV35"
  );

  // H. 最終返り値にも反映される
  assert.strictEqual(
    result.data.replyText,
    "【オーダースーツ金井】\n駐車場はございません。",
    "result replyText should be correct"
  );
  assert.strictEqual(
    result.data.companyId,
    "kanai_suit",
    "result companyId should be correct"
  );
  assert.strictEqual(
    result.data.topicLabel,
    "オーダースーツ金井",
    "result topicLabel should be correct"
  );

  console.log("");
  console.log("✅ 連結テスト成功");
  console.log(" - raw history -> normalizeConversationHistory : OK");
  console.log(" - normalized history -> runV35            : OK");
  console.log(" - runV35 result -> save/buildReply/result : OK");
  console.log("");

  console.log("=== test-v36-linkage END ===", new Date().toISOString());
}

main().catch((error) => {
  console.error("");
  console.error("❌ 連結テスト失敗");
  console.error(error);
  console.error("");
  process.exit(1);
});