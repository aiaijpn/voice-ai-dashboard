"use strict";

/*
最小単体テスト
ADR-008 history 保存の内部関数確認
*/

const {
  buildConversationRow,
} = require("../repositories/conversationRepository");

const {
  normalizeSaveInput,
  validateSaveInput,
} = require("../services/historyService");

console.log("=================================");
console.log("buildConversationRow test");
console.log("=================================");

const row = buildConversationRow({
  timestamp: 1710000000000,
  botId: "bot-a",
  userId: "user-123",
  userMessage: "こんにちは",
  aiReply: "こんにちは、どうしましたか？",
  operatorMemo: "memo",
  manualSend: true,
  sourceType: "message",
  unresolvedQ: false,
});

console.log(row);

console.log("\n=================================");
console.log("normalizeSaveInput test");
console.log("=================================");

const normalized = normalizeSaveInput({
  botId: "bot-a",
  userId: "user-123",
  userMessage: "質問です",
  aiReply: "回答です",
});

console.log(normalized);

console.log("\n=================================");
console.log("validateSaveInput OK test");
console.log("=================================");

console.log(validateSaveInput(normalized));

console.log("\n=================================");
console.log("validateSaveInput NG test");
console.log("=================================");

console.log(
  validateSaveInput({
    botId: "",
    userId: "",
  })
);