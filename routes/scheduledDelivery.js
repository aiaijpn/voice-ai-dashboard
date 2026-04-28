"use strict";

const express = require("express");
const { deliverScheduledTestMessage } = require("../services/scheduledDeliveryService");

const router = express.Router();

function isEnabled(key) {
  return String(process.env[key] || "").trim().toLowerCase() === "true";
}

router.post("/deliver", async (req, res) => {
  const expectedSecret = String(process.env.SCHEDULE_SECRET || "").trim();
  const receivedSecret = String(req.headers["x-schedule-secret"] || "").trim();

  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return res.status(401).json({
      success: false,
      message: "invalid schedule secret",
    });
  }

  if (!isEnabled("SCHEDULE_DELIVERY_ENABLED")) {
    return res.status(403).json({
      success: false,
      message: "scheduled delivery disabled",
    });
  }

  const result = await deliverScheduledTestMessage({
    message: req.body?.message,
  });

  return res.status(result.success ? 200 : 500).json(result);
});

module.exports = router;
