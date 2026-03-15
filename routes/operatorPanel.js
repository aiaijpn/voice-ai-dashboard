"use strict";

const express = require("express");
const axios = require("axios");

const { log, error: logError } = require("../utils/logger");
const { saveAdminMessageHistory } = require("../services/adminMessageService");
const { saveConversationHistory } = require("../services/historyService");

const router = express.Router();

// =============================
// Operator Panel（超簡易）
// =============================
router.get("/", (req, res) => {
  const current = globalThis.OPERATOR_AI_TONE || "polite";

  res.status(200).send(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Operator Panel</title>
</head>
<body style="font-family: system-ui; padding: 16px;">
  <h2>Operator Panel（実験機）</h2>

  <h3>AI口調（テイスト）</h3>
  <form method="POST" action="/operator/tone">
    <select name="tone">
      <option value="polite" ${current === "polite" ? "selected" : ""}>丁寧</option>
      <option value="casual" ${current === "casual" ? "selected" : ""}>カジュアル</option>
      <option value="sales" ${current === "sales" ? "selected" : ""}>営業寄り</option>
      <option value="gentle" ${current === "gentle" ? "selected" : ""}>やさしい</option>
    </select>
    <button type="submit">口調変更</button>
  </form>
  <p style="color:#666;">現在: <b>${current}</b></p>

  <hr/>

  <h3>個別送信（ADR-009 対応）</h3>
  <p style="color:#666;font-size:14px;">
    userId を指定して送信し、送信成功時のみ conversation_history に admin_message として保存します
  </p>
  <form method="POST" action="/operator/send">
    <div style="margin-bottom:8px;">
      <input
        type="text"
        name="botId"
        style="width:100%; max-width:720px;"
        placeholder="botId 例: example_bot"
      />
    </div>
    <div style="margin-bottom:8px;">
      <input
        type="text"
        name="userId"
        style="width:100%; max-width:720px;"
        placeholder="userId 例: Uxxxxxxxxxxxxxxxx"
      />
    </div>
    <textarea
      name="message"
      rows="6"
      style="width:100%; max-width:720px;"
      placeholder="送信メッセージ"
    ></textarea>
    <div style="margin-top:8px;">
      <button type="submit">個別送信</button>
    </div>
  </form>

  <hr/>

  <h3>Broadcast送信（全員へ）</h3>
  <p style="color:#666;font-size:14px;">
    broadcast API は userId を返さないため、現在は conversation_history 保存対象外です
  </p>
  <form method="POST" action="/operator/broadcast">
    <textarea name="message" rows="6" style="width:100%; max-width:720px;" placeholder="送信メッセージ"></textarea>
    <div style="margin-top:8px;">
      <button type="submit">送信</button>
    </div>
  </form>

  <hr/>

  <h3>Operatorプロフィール（M1）</h3>
  <p style="color:#666;font-size:14px;">
    AIが参照する人格文章（長文OK）
  </p>

  <textarea id="opProfileText"
  rows="10"
  style="width:100%;max-width:720px;font-size:16px;"
  placeholder="例：話し方、価値観、売り方、禁止事項など"></textarea>

  <br><br>

  <button type="button" onclick="saveOperatorProfile()">
    プロフィール保存
  </button>

  <p id="opProfileStatus" style="color:#666;font-size:12px;"></p>

  <hr/>
  <p style="color:#666; font-size:12px;">
    ※実験機：broadcast は履歴保存なし／個別送信のみ ADR-009 対応
  </p>

<script>
async function loadOperatorProfile(){
  try{
    const r = await fetch("/api/operator/profile");
    const d = await r.json();

    document.getElementById("opProfileText").value =
      d.profile_text || "";

    if(d.updated_at){
      document.getElementById("opProfileStatus").innerText =
      "updated : " + d.updated_at;
    }

  }catch(e){
    document.getElementById("opProfileStatus").innerText =
    "読み込み失敗";
  }
}

async function saveOperatorProfile(){
  const text =
    document.getElementById("opProfileText").value;

  document.getElementById("opProfileStatus").innerText =
  "保存中...";

  try{
    const r = await fetch("/api/operator/profile",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        profile_text:text
      })
    });

    await r.json();

    document.getElementById("opProfileStatus").innerText =
      "保存OK";

  }catch(e){
    document.getElementById("opProfileStatus").innerText =
      "保存失敗";
  }
}

window.onload = loadOperatorProfile;
</script>

  </body>
</html>`);
});

router.post("/tone", (req, res) => {
  const tone = String(req.body?.tone || "").trim();
  if (!tone) return res.status(400).send("tone is required");
  globalThis.OPERATOR_AI_TONE = tone;
  log("🎛️ OPERATOR tone set:", tone);
  return res.redirect("/operator");
});

// =============================
// ADR-009 個別送信
// C案:
// - admin_message は従来どおり保存
// - さらに ai_reply としても保存
//   → 次回AI会話時に assistant 発話として参照させる
// =============================
router.post("/send", async (req, res) => {
  const botId = String(req.body?.botId || "").trim();
  const userId = String(req.body?.userId || "").trim();
  const message = String(req.body?.message || "").trim();

  if (!botId) return res.status(400).send("botId is required");
  if (!userId) return res.status(400).send("userId is required");
  if (!message) return res.status(400).send("message is required");

  const token = process.env.CHANNEL_ACCESS_TOKEN;
  if (!token) return res.status(500).send("CHANNEL_ACCESS_TOKEN missing");

  try {
    log("========================================");
    log("📨 OPERATOR direct send requested");
    log("⏱️  time:", new Date().toISOString());
    log("🤖 botId:", botId);
    log("👤 userId:", userId);
    log("📝 message length:", message.length);
    log("🔑 OPERATOR send token prefix:", String(token).slice(0, 10));

    const lineResponse = await axios.post(
      "https://api.line.me/v2/bot/message/push",
      {
        to: userId,
        messages: [{ type: "text", text: message }],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    log("✅ OPERATOR LINE push success", {
      botId,
      userId,
      status: lineResponse.status,
      statusText: lineResponse.statusText,
    });

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

      return res
        .status(500)
        .send(`message sent but admin_message history save failed: ${adminHistoryResult.message}`);
    }

    log("✅ OPERATOR admin_message history saved");

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

      return res
        .status(500)
        .send(`message sent and admin history saved but ai_reply mirror save failed: ${aiReplyHistoryResult.message}`);
    }

    log("✅ OPERATOR ai_reply mirror history saved");
    log("✅ OPERATOR direct send success");
    log("✅ OPERATOR direct send history saved");

    return res.redirect("/operator");
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;

    logError(
      "❌ OPERATOR direct send failed:",
      status,
      data || err?.message || err
    );

    return res
      .status(500)
      .send(`direct send failed: ${status || ""} ${JSON.stringify(data || {})}`);
  }
});

// =============================
// Broadcast送信（全員へ）
// ※ LINE broadcast API は userId を返さないため
//    ADR-009 の per-user 履歴保存対象にはしない
// =============================
router.post("/broadcast", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).send("message is required");

  const token = process.env.CHANNEL_ACCESS_TOKEN;
  if (!token) return res.status(500).send("CHANNEL_ACCESS_TOKEN missing");

  try {
    log("========================================");
    log("📣 OPERATOR broadcast requested");
    log("⏱️  time:", new Date().toISOString());
    log("📝 message length:", message.length);
    log("🔑 OPERATOR broadcast token prefix:", String(token).slice(0, 10));

    const lineResponse = await axios.post(
      "https://api.line.me/v2/bot/message/broadcast",
      { messages: [{ type: "text", text: message }] },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    log("✅ OPERATOR broadcast LINE success", {
      status: lineResponse.status,
      statusText: lineResponse.statusText,
    });

    log(
      "ℹ️  OPERATOR broadcast history skip: LINE broadcast API has no per-user ids"
    );

    return res.redirect("/operator");
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    logError("❌ OPERATOR broadcast failed:", status, data || err?.message || err);
    return res
      .status(500)
      .send(`broadcast failed: ${status || ""} ${JSON.stringify(data || {})}`);
  }
});

module.exports = router;