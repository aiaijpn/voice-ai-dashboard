"use strict";

require("dotenv").config();

const {
  appendConversationRow,
} = require("../repositories/conversationRepository");

async function runTest() {
  const result = await appendConversationRow({
    timestamp: Date.now(),
    botId: "test_bot",
    userId: "U_TEST_123",
    userMessage: "ADR007 repository test",
    aiReply: "repository test reply",
    operatorMemo: "test memo",
    manualSend: false,
    sourceType: "repository_test",
    unresolvedQ: false,
  });

  console.log("RESULT:", result);
}

runTest();