"use strict";

// services/messageService.js
// 役割：LINE受信後の「考える処理」を集約する（分類/要約/保存/返信組み立て）
// まずは分割の土台として追加（将来3BOT対応もここで吸収する予定）

async function processMessage(context) {
  // context: { bot_id, userId, text, timestamp, rawEvent, ... }
  // TODO: classifier呼び出し、sheet保存、返信文作成を段階的に移す
  return {
    replyText: context?.text ? `受信しました：${context.text}` : "受信しました",
    meta: { moved: false }
  };
}

module.exports = { processMessage };
