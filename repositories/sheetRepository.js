"use strict";

const { appendRow } = require("../sheet/saver");

// repositories/sheetRepository.js
// 役割：Google Sheets への I/O を一箇所に閉じ込める
// 将来：シート分割・列追加・複数BOT対応もここで吸収

async function appendVoiceRow(data) {
  if (!data) return;

  await appendRow({
    timestamp: data.timestamp,
    user_text: data.user_text,
    summary: data.summary,
    category: data.category,
    urgency_score: data.urgency_score,
    reply_text: data.reply_text,
  });
}

module.exports = {
  appendVoiceRow,
};
