// server.js
"use strict";

const express = require("express");
const axios = require("axios");

// 入口ログ（起動確認）
console.log("🚀 SERVER BOOT: server.js is running");
console.log("⏱️  BOOT TIME:", new Date().toISOString());

// 環境変数の存在チェック（値は出さない）
const requiredEnv = [
  "CHANNEL_ACCESS_TOKEN",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "SPREADSHEET_ID",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "BASIC_USER",
  "BASIC_PASS",
];

for (const key of requiredEnv) {
  const ok = !!process.env[key];
  console.log(`🔧 ENV ${key}: ${ok ? "OK" : "MISSING"}`);
}

const { handleEvent } = require("./line/handler");

const app = express();

// ★ 口調（テイスト）をメモリ保持（実験機：最速）
globalThis.OPERATOR_AI_TONE = globalThis.OPERATOR_AI_TONE || "polite";

// JSONパース（LINE webhook受信）
app.use(express.json({ limit: "2mb" }));
// HTMLフォーム（operator panel）
app.use(express.urlencoded({ extended: false }));

// =============================
// Basic認証（超簡易）
// =============================
function basicAuth(req, res, next) {
  const user = process.env.BASIC_USER || "";
  const pass = process.env.BASIC_PASS || "";

  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Operator Panel"');
    return res.status(401).send("Authentication required");
  }

  const b64 = auth.slice("Basic ".length);
  const [u, p] = Buffer.from(b64, "base64").toString("utf8").split(":");

  if (u === user && p === pass) return next();

  res.setHeader("WWW-Authenticate", 'Basic realm="Operator Panel"');
  return res.status(401).send("Invalid credentials");
}

// =============================
// ヘルスチェック
// =============================
app.get("/", (req, res) => {
  console.log("✅ GET / healthcheck");
  res.status(200).send("ok");
});

app.get("/healthz", (req, res) => {
  res.status(200).json({ ok: true, time: new Date().toISOString() });
});

// =============================
// Operator Panel（超簡易）
// =============================
app.get("/operator", basicAuth, (req, res) => {
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

  <h3>Broadcast送信（全員へ）</h3>
  <form method="POST" action="/operator/broadcast">
    <textarea name="message" rows="6" style="width:100%; max-width:720px;" placeholder="送信メッセージ"></textarea>
    <div style="margin-top:8px;">
      <button type="submit">送信</button>
    </div>
  </form>

  <hr/>
  <p style="color:#666; font-size:12px;">※実験機：ログ保存なし／再起動で口調が初期化される可能性あり</p>
</body>
</html>`);
});

app.post("/operator/tone", basicAuth, (req, res) => {
  const tone = String(req.body?.tone || "").trim();
  if (!tone) return res.status(400).send("tone is required");
  globalThis.OPERATOR_AI_TONE = tone;
  console.log("🎛️ OPERATOR tone set:", tone);
  return res.status(200).send(`tone set: ${tone}`);
});

app.post("/operator/broadcast", basicAuth, async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).send("message is required");

  const token = process.env.CHANNEL_ACCESS_TOKEN;
  if (!token) return res.status(500).send("CHANNEL_ACCESS_TOKEN missing");

  try {
    console.log("========================================");
    console.log("📣 OPERATOR broadcast requested");
    console.log("⏱️  time:", new Date().toISOString());
    console.log("📝 message length:", message.length);

    await axios.post(
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

    console.log("✅ OPERATOR broadcast success");
    return res.status(200).send("broadcast ok");
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error("❌ OPERATOR broadcast failed:", status, data || err?.message || err);
    return res
      .status(500)
      .send(`broadcast failed: ${status || ""} ${JSON.stringify(data || {})}`);
  }
});

// =============================
// Webhook受信
// =============================
app.post("/webhook", async (req, res) => {
  const rid = Math.random().toString(16).slice(2, 8);
  const start = Date.now();

  try {
    console.log("========================================");
    console.log(`📩 [${rid}] POST /webhook received`);
    console.log(`📌 [${rid}] time=${new Date().toISOString()}`);
    console.log(
      `📌 [${rid}] headers x-line-signature=${
        req.headers["x-line-signature"] ? "present" : "none"
      }`
    );
    console.log(`📦 [${rid}] body keys=`, Object.keys(req.body || {}));

    const events = req.body?.events || [];
    console.log(`📨 [${rid}] events length=${events.length}`);

    // LINEへの応答はタイムアウトが怖いので、先に200返す（超重要）
    res.status(200).send("OK");

    if (!events.length) {
      console.log(`⚠️  [${rid}] no events -> done`);
      return;
    }

    const tone = globalThis.OPERATOR_AI_TONE || "polite";

    // イベント処理（並列）
    const results = await Promise.allSettled(
      events.map(async (ev, idx) => {
        console.log(
          `➡️  [${rid}] handleEvent start idx=${idx} type=${ev.type} msgType=${ev.message?.type}`
        );
        await handleEvent(ev, { tone });
        console.log(`✅ [${rid}] handleEvent done  idx=${idx}`);
      })
    );

    // 結果集計ログ
    const okCount = results.filter((r) => r.status === "fulfilled").length;
    const ng = results
      .map((r, i) => ({ r, i }))
      .filter((x) => x.r.status === "rejected")
      .map((x) => ({
        idx: x.i,
        reason: String(x.r.reason?.message || x.r.reason),
      }));

    console.log(`📊 [${rid}] results ok=${okCount} ng=${ng.length}`);
    if (ng.length) console.log(`❌ [${rid}] rejected details=`, ng);

    console.log(`⏱️  [${rid}] total ms=${Date.now() - start}`);
  } catch (err) {
    console.error(
      `💥 [${rid}] webhook handler error:`,
      err?.response?.data || err?.message || err
    );
    console.error(`⏱️  [${rid}] error total ms=${Date.now() - start}`);
  }
});

// ポート
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
});
