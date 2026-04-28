"use strict";

const express = require("express");
const { log } = require("../utils/logger");

const router = express.Router();

// =============================
// ヘルスチェック
// =============================
router.get("/", (req, res) => {
  log("✅ GET / healthcheck");
  res.status(200).send("ok");
});

router.get("/healthz", (req, res) => {
  res.status(200).json({ ok: true, time: new Date().toISOString() });
});

// ===============================
// Health Check（Renderスリープ対策）
// ===============================
router.get("/health", (req, res) => {
  res.status(200).send("ok");
});

module.exports = router;