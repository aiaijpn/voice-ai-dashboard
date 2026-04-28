"use strict";

const express = require("express");

const { log, error: logError } = require("../utils/logger");
const { sendOperatorMessage } = require("../services/operatorSendService");
const lineSender = require("../modules/lineSender");

const router = express.Router();

// =============================
// Operator Panel（超簡易）
// =============================
router.get("/", (req, res) => {
  const current = globalThis.OPERATOR_AI_TONE || "polite";
  const appEnv = String(process.env.APP_ENV || "production").trim() || "production";
  const broadcastEnabled =
    String(process.env.LINE_BROADCAST_ENABLED || "").trim().toLowerCase() === "true";

  res.status(200).send(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Operator Panel</title>
</head>
<body style="font-family: system-ui; padding: 16px;">
  <h2>Operator Panel（実験機）</h2>

  <div style="margin:12px 0; padding:12px; max-width:720px; background:#fff8c5; border:1px solid #d4a72c; border-radius:8px;">
    <div style="font-weight:700;">Environment: ${appEnv}</div>
    <div style="font-size:14px;color:#444;">Broadcast enabled: ${broadcastEnabled ? "true" : "false"}</div>
  </div>

  <div style="margin:12px 0; padding:12px; max-width:720px; background:#f6f8fa; border:1px solid #d0d7de; border-radius:8px;">
    <div style="font-weight:700; margin-bottom:6px;">ADR-013C 反映済み</div>
    <div style="font-size:14px; color:#444;">
      operatorPanel route 分離済み。この画面は <b>routes/operatorPanel.js</b> から配信中です。
    </div>
  </div>

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
// ADR-013D 個別送信 service 化
// =============================
router.post("/send", async (req, res) => {
  const result = await sendOperatorMessage({
    botId: req.body?.botId,
    userId: req.body?.userId,
    message: req.body?.message,
  });

  if (!result.success) {
    return res.status(500).send(result.message);
  }

  return res.redirect("/operator");
});

// =============================
// Broadcast送信（全員へ）
// ※ LINE broadcast API は userId を返さないため
//    ADR-009 の per-user 履歴保存対象にはしない
// =============================
router.post("/broadcast", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).send("message is required");

  try {
    log("========================================");
    log("📣 OPERATOR broadcast requested");
    log("⏱️  time:", new Date().toISOString());
    log("📝 message length:", message.length);

    const sendResult = await lineSender.sendBroadcast([
      { type: "text", text: message },
    ]);

    if (!sendResult.success) {
      return res.status(403).send(sendResult.message);
    }

    log("✅ OPERATOR broadcast LINE success", {
      lineResult: sendResult.data || null,
    });

    log(
      "ℹ️  OPERATOR broadcast history skip: LINE broadcast API has no per-user ids"
    );

    return res.redirect("/operator");
  } catch (err) {
    logError("❌ OPERATOR broadcast failed:", err?.message || err);
    return res
      .status(500)
      .send(`broadcast failed: ${err?.message || String(err)}`);
  }
});

module.exports = router;
