"use strict";

require("dotenv").config();


const { log, error: logError } = require("./utils/logger");

const express = require("express");

const operatorProfileRoutes = require("./routes/operatorProfile");
const basicAuth = require("./middleware/basicAuth");
const healthRoutes = require("./routes/health");
const operatorPanelRoutes = require("./routes/operatorPanel");
const scheduledDeliveryRoutes = require("./routes/scheduledDelivery");
const webappDeliveryRoutes = require("./routes/webappDelivery");

const app = express();

app.use("/api/operator", operatorProfileRoutes);

// 入口ログ（起動確認）
log("🚀 SERVER BOOT: server.js is running");
log("⏱️  BOOT TIME:", new Date().toISOString());
log("### ENTRY V3.53 ###");
log("🔧 APP_ENV:", process.env.APP_ENV || "production");

// 環境変数の存在チェック（値は出さない）
const requiredEnv = [
  "APP_ENV",
  "CHANNEL_ACCESS_TOKEN",
  "LINE_REPLY_ENABLED",
  "LINE_PUSH_ENABLED",
  "LINE_BROADCAST_ENABLED",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "SPREADSHEET_ID",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "BASIC_USER",
  "BASIC_PASS",
  "STAGING_ALLOWED_LINE_USER_IDS",
  "SCHEDULE_SECRET",
  "SCHEDULE_DELIVERY_ENABLED",
  "SCHEDULE_TARGET_LINE_USER_IDS",
  "WEBAPP_TRIGGER_SECRET",
  "WEBAPP_DELIVERY_ENABLED",
];

for (const key of requiredEnv) {
  const ok = !!process.env[key];
  log(`🔧 ENV ${key}: ${ok ? "OK" : "MISSING"}`);
}

const { handleEvent } = require("./line/handler");

// ★ 口調（テイスト）をメモリ保持（実験機：最速）
globalThis.OPERATOR_AI_TONE = globalThis.OPERATOR_AI_TONE || "polite";

// JSONパース（LINE webhook受信）
app.use(express.json({ limit: "2mb" }));
// HTMLフォーム（operator panel）
app.use(express.urlencoded({ extended: false }));

app.use("/", healthRoutes);
app.use("/operator", basicAuth, operatorPanelRoutes);
app.use("/scheduled", scheduledDeliveryRoutes);
app.use("/api/delivery", webappDeliveryRoutes);

// =============================
// Webhook受信
// =============================
app.post("/webhook", async (req, res) => {
  const rid = Math.random().toString(16).slice(2, 8);
  const start = Date.now();

  try {
    log("========================================");
    log(`📩 [${rid}] POST /webhook received`);
    log(`📌 [${rid}] time=${new Date().toISOString()}`);
    log(
      `📌 [${rid}] headers x-line-signature=${
        req.headers["x-line-signature"] ? "present" : "none"
      }`
    );
    log(`📦 [${rid}] body keys=`, Object.keys(req.body || {}));

    const events = req.body?.events || [];
    log(`📨 [${rid}] events length=${events.length}`);

    res.status(200).send("OK");

    if (!events.length) {
      log(`⚠️  [${rid}] no events -> done`);
      return;
    }

    const tone = globalThis.OPERATOR_AI_TONE || "polite";

    const results = await Promise.allSettled(
      events.map(async (ev, idx) => {
        log(
          `➡️  [${rid}] handleEvent start idx=${idx} type=${ev.type} msgType=${ev.message?.type}`
        );
        await handleEvent(ev, { tone });
        log(`✅ [${rid}] handleEvent done  idx=${idx}`);
      })
    );

    const okCount = results.filter((r) => r.status === "fulfilled").length;
    const ng = results
      .map((r, i) => ({ r, i }))
      .filter((x) => x.r.status === "rejected")
      .map((x) => ({
        idx: x.i,
        reason: String(x.r.reason?.message || x.r.reason),
      }));

    log(`📊 [${rid}] results ok=${okCount} ng=${ng.length}`);
    if (ng.length) log(`❌ [${rid}] rejected details=`, ng);

    log(`⏱️  [${rid}] total ms=${Date.now() - start}`);
  } catch (err) {
    logError(
      `💥 [${rid}] webhook handler error:`,
      err?.response?.data || err?.message || err
    );
    logError(`⏱️  [${rid}] error total ms=${Date.now() - start}`);
  }
});

// ポート
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  log(`🟢 Server running on port ${PORT}`);
});
