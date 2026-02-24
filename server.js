// server.js
"use strict";

const express = require("express");

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
];

for (const key of requiredEnv) {
  const ok = !!process.env[key];
  console.log(`🔧 ENV ${key}: ${ok ? "OK" : "MISSING"}`);
}

const { handleEvent } = require("./line/handler");

const app = express();

// JSONパース（LINE webhook受信）
app.use(express.json({ limit: "2mb" }));

// ヘルスチェック
app.get("/", (req, res) => {
  console.log("✅ GET / healthcheck");
  res.status(200).send("ok");
});

// Render用（念のため）
app.get("/healthz", (req, res) => {
  res.status(200).json({ ok: true, time: new Date().toISOString() });
});

// Webhook受信（LINE DevelopersのWebhook URLはここに向ける）
app.post("/webhook", async (req, res) => {
  const rid = Math.random().toString(16).slice(2, 8);
  const start = Date.now();

  try {
    console.log("========================================");
    console.log(`📩 [${rid}] POST /webhook received`);
    console.log(`📌 [${rid}] time=${new Date().toISOString()}`);
    console.log(`📌 [${rid}] headers x-line-signature=${req.headers["x-line-signature"] ? "present" : "none"}`);
    console.log(`📦 [${rid}] body keys=`, Object.keys(req.body || {}));

    const events = req.body?.events || [];
    console.log(`📨 [${rid}] events length=${events.length}`);

    // LINEへの応答はタイムアウトが怖いので、先に200返す（超重要）
    res.status(200).send("OK");

    if (!events.length) {
      console.log(`⚠️  [${rid}] no events -> done`);
      return;
    }

    // イベント処理（並列）
    const results = await Promise.allSettled(
      events.map(async (ev, idx) => {
        console.log(`➡️  [${rid}] handleEvent start idx=${idx} type=${ev.type} msgType=${ev.message?.type}`);
        await handleEvent(ev);
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
    // ここはres返し済みの可能性が高いので、ログだけ厚く
    console.error(`💥 [${rid}] webhook handler error:`, err?.response?.data || err?.message || err);
    console.error(`⏱️  [${rid}] error total ms=${Date.now() - start}`);
  }
});

// ポート
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
});
