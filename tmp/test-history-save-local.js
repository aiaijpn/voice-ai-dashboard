"use strict";

/*
最小単体テスト
saveConversationHistory() の内部接続確認

このテストでは Google Sheets は呼ばない。
repository を一時的に差し替えて確認する。
*/

const historyService = require("../services/historyService");
const conversationRepository = require("../repositories/conversationRepository");

async function main() {
  console.log("=================================");
  console.log("saveConversationHistory OK test");
  console.log("=================================");

  // 元の関数を退避
  const originalAppendConversationRow =
    conversationRepository.appendConversationRow;

  // 一時モックに差し替え
  conversationRepository.appendConversationRow = async function mockSuccess(
    input
  ) {
    console.log("[mock appendConversationRow called]");
    console.log(input);

    return {
      success: true,
      message: "mock repository success",
      data: {
        mocked: true,
        receivedBotId: input.botId,
        receivedUserId: input.userId,
      },
    };
  };

  const okResult = await historyService.saveConversationHistory({
    botId: "bot-a",
    userId: "user-123",
    userMessage: "質問です",
    aiReply: "回答です",
  });

  console.log(okResult);

  console.log("\n=================================");
  console.log("saveConversationHistory NG test");
  console.log("=================================");

  const ngResult = await historyService.saveConversationHistory({
    botId: "",
    userId: "",
    userMessage: "質問です",
    aiReply: "回答です",
  });

  console.log(ngResult);

  // 元に戻す
  conversationRepository.appendConversationRow = originalAppendConversationRow;
}

main().catch((error) => {
  console.error("test failed:", error);
});