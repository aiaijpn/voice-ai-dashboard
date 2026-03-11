"use strict";

async function handleConversation(context) {

  // 会話生成ロジック

  return {
    ...context,
    aiReply: "AI応答"
  };
}

module.exports = handleConversation;