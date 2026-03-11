"use strict";

async function classifyMessage(context) {

  // 既存 messageService 内の分類処理をここに移動

  return {
    ...context,
    category: 1,
    urgency: 5
  };
}

module.exports = classifyMessage;