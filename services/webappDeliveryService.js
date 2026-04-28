"use strict";

const lineSender = require("../modules/lineSender");
const { success, fail } = require("../utils/serviceResponse");

function getCsvValues(key) {
  return String(process.env[key] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeBodyTargetUserIds(body = {}) {
  if (Array.isArray(body.userIds)) {
    return body.userIds.map((value) => String(value || "").trim()).filter(Boolean);
  }

  const userId = String(body.userId || "").trim();
  if (userId) {
    return [userId];
  }

  return getCsvValues("STAGING_ALLOWED_LINE_USER_IDS");
}

async function deliverWebappMessage(input = {}) {
  const message = String(input.message || "").trim();
  const targetUserIds = normalizeBodyTargetUserIds(input);

  if (!message) {
    return fail("message is required");
  }

  if (targetUserIds.length === 0) {
    return fail("target userId or STAGING_ALLOWED_LINE_USER_IDS is required");
  }

  const results = [];

  for (const userId of targetUserIds) {
    const result = await lineSender.sendPush(userId, [
      {
        type: "text",
        text: message,
      },
    ]);

    results.push({
      userId,
      success: Boolean(result.success),
      message: result.message,
      data: result.data || null,
    });
  }

  const failed = results.filter((result) => !result.success);

  if (failed.length > 0) {
    return fail("webapp delivery partially failed", {
      total: results.length,
      failed: failed.length,
      results,
    });
  }

  return success(
    {
      total: results.length,
      results,
    },
    "webapp delivery sent"
  );
}

module.exports = {
  normalizeBodyTargetUserIds,
  deliverWebappMessage,
};
