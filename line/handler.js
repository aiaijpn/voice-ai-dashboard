"use strict";

const { log, error: logError } = require("../utils/logger");
const axios = require("axios");
const { processMessage } = require("../services/messageService/index");
const lineSender = require("../modules/lineSender");

const { appendRowToSheet } = require("../sheet/saver");

log("📦 handler.js loaded:", new Date().toISOString());

const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;

log("🔧 ENV CHECK (handler)");
log(" - CHANNEL_ACCESS_TOKEN:", CHANNEL_ACCESS_TOKEN ? "OK" : "MISSING");

// historyStore は STEP2 で新規作成する想定。
// 先に handler.js を直しても落ちないように「存在すれば使う」方式
let historyStore = null;

try {
  historyStore = require("./historyStore");
  log("🧠 historyStore: OK (./historyStore)");
} catch (e) {
  log("🧠 historyStore: NOT FOUND -> history disabled");
}

const HISTORY_MAX = Number(process.env.HISTORY_MAX || 10);

function buildTextWithHistory(userText, history = []) {
  if (!history || history.length === 0) return userText;

  const lines = history
    .slice(-HISTORY_MAX)
    .map((m) => {
      const role = m.role === "assistant" ? "AI" : "User";
      const content = String(m.content || "").replace(/\s+/g, " ").trim();
      return `${role}: ${content}`;
    })
    .join("\n");

  return `【直近の会話】\n${lines}\n\n【今回】\nUser: ${userText}`;
}

const handleEvent = async (event, ctx = {}) => {
  const rid = Math.random().toString(16).slice(2, 8);

  try {
    log("========================================");
    log(`➡️ [${rid}] handleEvent start`);
    log(`type=${event.type}`);
    log(`messageType=${event.message?.type}`);

    if (event.type !== "message" || event.message.type !== "text") {
      log(`⚠️ [${rid}] Not text message`);
      return;
    }

    await adr007b1AppendTest(event);


    const userText = event.message.text;
    log(`📝 [${rid}] userText=`, userText);

    const markAsReadToken = event.message?.markAsReadToken;

    const tone = String(ctx.tone || "polite");
    const bot_id = process.env.BOT_ID || "voice-ai-dashboard";
    const userId = event.source?.userId || "";

    const historyKey = `${bot_id}:${userId || "no_userId"}`;

    // ===== 履歴ロード =====
    let history = [];

    if (historyStore?.getHistory) {
      try {
        history = await historyStore.getHistory(historyKey);
        log(`🧠 [${rid}] history loaded len=${history.length}`);
      } catch (e) {
        log(`history load error`, e.message);
      }
    }

    // ===== ユーザー発言保存 =====
    if (historyStore?.appendMessage) {
      try {
        await historyStore.appendMessage(historyKey, {
          role: "user",
          content: userText,
        });

        history = await historyStore.getHistory(historyKey);
      } catch (e) {
        log(`history append error`, e.message);
      }
    }

    const textForAI = buildTextWithHistory(userText, history);

    // ===== AI処理 =====
    const result = await processMessage({
      rid,
      bot_id,
      userId,
      text: textForAI,
      tone,
    });

    if (!result?.success) {
      logError(`❌ [${rid}] service fail:`, result?.message || "unknown error");
      return;
    }

    const replyText = result?.data?.replyText || "受信しました";

    log(`🧩 [${rid}] service result message=`, result.message);
    log(`🧩 [${rid}] service replyText=`, replyText);

    // ===== AI発言履歴保存 =====
    if (historyStore?.appendMessage) {
      try {
        await historyStore.appendMessage(historyKey, {
          role: "assistant",
          content: replyText,
        });
      } catch (e) {
        log(`history append error`, e.message);
      }
    }

    // ===== LINE返信 =====
    log(`📤 [${rid}] sending reply`);

    const sendResult = await lineSender.sendReply(event.replyToken, [
      { type: "text", text: replyText },
    ]);

    if (!sendResult?.success) {
      logError(`❌ [${rid}] LINE send failed:`, sendResult?.message || "unknown error");
      return;
    }

    log(`🎉 [${rid}] LINE reply success`);

    // ===== 既読 =====
    if (markAsReadToken) {
      try {
        await axios.post(
          "https://api.line.me/v2/bot/chat/markAsRead",
          { markAsReadToken },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
            },
          }
        );
        log(`👁️ [${rid}] markAsRead success`);
      } catch (e) {
        log(`markAsRead failed`, e.message);
      }
    }

    log(`⬅️ [${rid}] handleEvent done`);
  } catch (e) {
    logError("💥 Handler error:", e.response?.data || e.message || e);
  }
};

module.exports = { handleEvent };



// ===== ADR007B1 実験用 =====


async function adr007b1AppendTest(event) {
  try {

    const row = [
      Date.now(),
      "test_bot",
      event?.source?.userId || "unknown_user",
      "LINE webhook first hit",
      "ADR007B1 test append",
      "test memo",
      false,
      "line_webhook_test",
      false
    ];

    await appendRowToSheet({
      spreadsheetId: process.env.SPREADSHEET_ID,
      sheetName: "conversation_history",
      values: row
    });

    log("ADR007B1 append success");

  } catch (err) {
    log("ADR007B1 append error", err.message);
  }
}


/*
const { google } = require("googleapis");

async function adr007b1AppendTest(event) {
  try {

    
    log("ADR007B1 env debug", {
     hasSheetId: !!process.env.XX_SHEET_ID,
    hasSaEmail: !!process.env.XX_SA_EMAIL,
     hasSaKey: !!process.env.XX_SA_KEY,
      sheetIdLength: process.env.XX_SHEET_ID ? process.env.XX_SHEET_ID.length : 0,
      saKeyLength: process.env.XX_SA_KEY ? process.env.XX_SA_KEY.length : 0,
    });

    if (
      !process.env.XX_SHEET_ID  ||
      !process.env.XX_SA_EMAIL  ||
      !process.env.XX_SA_KEY
    ) {
      log("ADR007B1 skip: env missing");
      return;
    }

    const auth = new google.auth.JWT(
      process.env.XX_SA_EMAIL,
      null,
      process.env.XX_SA_KEY.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );


    const authResult = await auth.authorize();
    log("ADR007B1 auth success", {
      accessTokenExists: !!authResult.access_token,
    });

    const sheets = google.sheets({ version: "v4", auth });
    
   
     const row = [[
      Date.now(),
      "test_bot",
      event?.source?.userId || "unknown_user",
      "LINE webhook first hit",
      "ADR007B1 test append",
      "test memo",
      false,
      "line_webhook_test",
      false
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "conversation_history",
      valueInputOption: "RAW",
      requestBody: { values: row },
    });

    log("ADR007B1 append success");

  } catch (err) {
    log("ADR007B1 append error", err.message);
  }
}
  */