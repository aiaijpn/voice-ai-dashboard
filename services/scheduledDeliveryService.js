"use strict";

const lineSender = require("../modules/lineSender");
const { success, fail } = require("../utils/serviceResponse");

const DEFAULT_SCHEDULE_MESSAGE = "staging scheduled delivery test";

function getCsvValues(key) {
  return String(process.env[key] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getScheduleTargetUserIds() {
  const explicitTargets = getCsvValues("SCHEDULE_TARGET_LINE_USER_IDS");
  if (explicitTargets.length > 0) {
    return explicitTargets;
  }

  return getCsvValues("STAGING_ALLOWED_LINE_USER_IDS");
}

async function deliverScheduledTestMessage(input = {}) {
  const message = String(input.message || DEFAULT_SCHEDULE_MESSAGE).trim();
  const targetUserIds = getScheduleTargetUserIds();

  if (!message) {
    return fail("scheduled delivery message is required");
  }

  if (targetUserIds.length === 0) {
    return fail(
      "SCHEDULE_TARGET_LINE_USER_IDS or STAGING_ALLOWED_LINE_USER_IDS is required"
    );
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
    return fail("scheduled delivery partially failed", {
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
    "scheduled delivery sent"
  );
}

module.exports = {
  DEFAULT_SCHEDULE_MESSAGE,
  getScheduleTargetUserIds,
  deliverScheduledTestMessage,
};
