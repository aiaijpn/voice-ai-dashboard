"use strict";

/*
  ADR-013D
  operator send を service 化

  目的
  --------------------------------
  routes/operatorPanel.js から
  個別送信ロジックを分離する。

  route は
    ・入力受付
    ・service呼び出し
    ・レスポンス返却

  のみとし、

  業務ロジックは
    services/
  に集約する。

  これにより

  server.js
  routes
  services

  の責務が明確になる。
*/

const axios = require("axios");

const { log, error: logError } = require("../utils/logger");
const { saveAdminMessageHistory } = require("./adminMessageService");
const { saveConversationHistory } = require("./historyService");
const { success, fail } = require("../utils/serviceResponse");

/*
  sendOperatorMessage

  Operator Panel からの
  個別送信を処理する service。

  処理の流れ

  ①入力チェック
  ②LINE push API送信
  ③admin_message 保存
  ④ai_reply mirror 保存
*/
async function sendOperatorMessage(input = {}) {
  /*
    入力正規化
    ----------------------------
    routeから渡された値を
    安全に文字列化
  */
  const botId = String(input.botId || "").trim();
  const userId = String(input.userId || "").trim();
  const message = String(input.message || "").trim();

  /*
    入力チェック
    ----------------------------
    必須項目
  */
  if (!botId) return fail("botId is required");
  if (!userId) return fail("userId is required");
  if (!message) return fail("message is required");

  /*
    LINEアクセストークン取得
  */
  const token = process.env.CHANNEL_ACCESS_TOKEN;

  if (!token) {
    return fail("CHANNEL_ACCESS_TOKEN missing");
  }

  try {
    /*
      ログ
      ----------------------------
      operator送信開始
    */
    log("========================================");
    log("📨 OPERATOR direct send requested");
    log("⏱️  time:", new Date().toISOString());
    log("🤖 botId:", botId);
    log("👤 userId:", userId);
    log("📝 message length:", message.length);

    /*
      セキュリティ配慮
      tokenは先頭のみログ
    */
    log("🔑 OPERATOR send token prefix:", String(token).slice(0, 10));

    /*
      LINE push API
      ----------------------------
      https://developers.line.biz
    */
    const lineResponse = await axios.post(
      "https://api.line.me/v2/bot/message/push",
      {
        to: userId,
        messages: [
          {
            type: "text",
            text: message,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    /*
      LINE送信成功
    */
    log("✅ OPERATOR LINE push success", {
      botId,
      userId,
      status: lineResponse.status,
      statusText: lineResponse.statusText,
    });

    /*
      --------------------------------
      admin_message 保存
      --------------------------------

      Operator送信は
      conversation_history に

      admin_message

      として保存する。
    */
    const adminHistoryResult = await saveAdminMessageHistory({
      botId,
      userId,
      messageText: message,
      operatorMemo: "operator panel send",
      timestamp: Date.now(),
    });

    if (!adminHistoryResult.success) {
      logError("❌ OPERATOR admin_message history save failed", {
        botId,
        userId,
        message: adminHistoryResult.message,
        data: adminHistoryResult.data || null,
      });

      return fail(
        `message sent but admin_message history save failed: ${adminHistoryResult.message}`,
        {
          step: "saveAdminMessageHistory",
          botId,
          userId,
        }
      );
    }

    log("✅ OPERATOR admin_message history saved");

    /*
      --------------------------------
      ai_reply mirror 保存
      --------------------------------

      次回AI会話時に
      assistant発話として
     履歴に参照させるため

      ai_reply
      としても保存する。
    */
    const aiReplyHistoryResult = await saveConversationHistory({
      botId,
      userId,

      timestamp: Date.now(),

      userMessage: "",
      aiReply: message,

      operatorMemo: "operator panel send (assistant mirror)",

      manualSend: false,
      sourceType: "ai_reply",

      unresolvedQ: false,
    });

    if (!aiReplyHistoryResult.success) {
      logError("❌ OPERATOR ai_reply mirror save failed", {
        botId,
        userId,
        message: aiReplyHistoryResult.message,
        data: aiReplyHistoryResult.data || null,
      });

      return fail(
        `message sent and admin history saved but ai_reply mirror save failed: ${aiReplyHistoryResult.message}`,
        {
          step: "saveConversationHistory",
          botId,
          userId,
        }
      );
    }

    log("✅ OPERATOR ai_reply mirror history saved");

    /*
      最終成功
    */
    log("✅ OPERATOR direct send success");

    return success("operator send success", {
      botId,
      userId,
      messageLength: message.length,
      lineStatus: lineResponse.status,
    });
  } catch (err) {
    /*
      LINE API エラー
    */
    const status = err?.response?.status;
    const data = err?.response?.data;

    logError(
      "❌ OPERATOR direct send failed:",
      status,
      data || err?.message || err
    );

    return fail(
      `direct send failed: ${status || ""} ${JSON.stringify(data || {})}`,
      {
        botId,
        userId,
        status: status || null,
        error: data || err?.message || String(err),
      }
    );
  }
}

/*
  export
*/
module.exports = {
  sendOperatorMessage,
};