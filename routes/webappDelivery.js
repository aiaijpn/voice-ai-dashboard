"use strict";

const express = require("express");
const { deliverWebappMessage } = require("../services/webappDeliveryService");

const router = express.Router();

function isEnabled(key) {
  return String(process.env[key] || "").trim().toLowerCase() === "true";
}

router.post("/webapp-trigger", async (req, res) => {
  const expectedSecret = String(process.env.WEBAPP_TRIGGER_SECRET || "").trim();
  const receivedSecret = String(req.headers["x-webapp-secret"] || "").trim();

  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return res.status(401).json({
      success: false,
      message: "invalid webapp secret",
    });
  }

  if (!isEnabled("WEBAPP_DELIVERY_ENABLED")) {
    return res.status(403).json({
      success: false,
      message: "webapp delivery disabled",
    });
  }

  const result = await deliverWebappMessage(req.body || {});

  return res.status(result.success ? 200 : 500).json(result);
});

module.exports = router;
