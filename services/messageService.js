"use strict";

// services/messageService.js
// 役割：LINE受信後の「考える処理」を集約する（分類/要約/保存/返信組み立て）
// 現段階：handler.js で得たAI結果を受け取り、返信文を決めて返す（中継）
// 将来：OpenAI呼び出し、Sheets保存もここへ移す（3BOT対応も吸収）

async function processMessage(context) {
  // context: {
  //   bot_id, userId, text, timestamp, rawEvent,
  //   ai: { reply_text, summary, category, urgency_score }   ← 次で使う
  // }

  const aiReply = context?.ai?.reply_text;

  return {
    // いまは挙動維持：AI返信をそのまま返す
    replyText: aiReply || "受信しました",
    meta: { moved: "reply-only", bot_id: context?.bot_id || "" },
  };
}

module.exports = { processMessage };
