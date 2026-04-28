"use strict";

const axios = require("axios");
const { log, error: logError } = require("../utils/logger");
const { success, fail } = require("../utils/serviceResponse");

const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;
const LINE_API_BASE = "https://api.line.me/v2/bot/message";

function getAppEnv() {
  return String(process.env.APP_ENV || "production").trim() || "production";
}

function isEnvEnabled(key) {
  return String(process.env[key] || "").trim().toLowerCase() === "true";
}

function getCsvValues(key) {
  return String(process.env[key] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function ensureChannelAccessToken(method) {
  if (CHANNEL_ACCESS_TOKEN) {
    return null;
  }

  logError(`lineSender.${method}: CHANNEL_ACCESS_TOKEN is missing`);
  return fail("LINE send failed", {
    method,
    reason: "CHANNEL_ACCESS_TOKEN is missing",
  });
}

function ensureReplyAllowed() {
  const appEnv = getAppEnv();

  if (isEnvEnabled("LINE_REPLY_ENABLED")) {
    return null;
  }

  logError("lineSender.sendReply: LINE_REPLY_ENABLED is not true", {
    appEnv,
  });

  return fail("LINE reply disabled", {
    method: "reply",
    reason: "LINE_REPLY_ENABLED is not true",
    appEnv,
  });
}

function ensurePushAllowed(userId) {
  const appEnv = getAppEnv();

  if (!isEnvEnabled("LINE_PUSH_ENABLED")) {
    logError("lineSender.sendPush: LINE_PUSH_ENABLED is not true", {
      appEnv,
      userId,
    });

    return fail("LINE push disabled", {
      method: "push",
      reason: "LINE_PUSH_ENABLED is not true",
      appEnv,
      userId,
    });
  }

  if (appEnv === "staging") {
    const allowedUserIds = getCsvValues("STAGING_ALLOWED_LINE_USER_IDS");

    if (!allowedUserIds.includes(userId)) {
      logError("lineSender.sendPush: staging userId is not allowlisted", {
        appEnv,
        userId,
        allowedCount: allowedUserIds.length,
      });

      return fail("LINE push rejected by staging allowlist", {
        method: "push",
        reason: "userId is not in STAGING_ALLOWED_LINE_USER_IDS",
        appEnv,
        userId,
      });
    }
  }

  return null;
}

function ensureBroadcastAllowed() {
  const appEnv = getAppEnv();

  if (isEnvEnabled("LINE_BROADCAST_ENABLED")) {
    return null;
  }

  logError("lineSender.sendBroadcast: LINE_BROADCAST_ENABLED is not true", {
    appEnv,
  });

  return fail("LINE broadcast disabled", {
    method: "broadcast",
    reason: "LINE_BROADCAST_ENABLED is not true",
    appEnv,
  });
}

function buildHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
  };
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.filter(Boolean);
}

async function sendReply(replyToken, messages) {
  try {
    const tokenGuard = ensureChannelAccessToken("sendReply");
    if (tokenGuard) return tokenGuard;

    const enabledGuard = ensureReplyAllowed();
    if (enabledGuard) return enabledGuard;

    if (!replyToken) {
      logError("lineSender.sendReply: replyToken is missing");
      return fail("LINE send failed", {
        reason: "replyToken is missing",
      });
    }

    const normalizedMessages = normalizeMessages(messages);

    if (normalizedMessages.length === 0) {
      logError("lineSender.sendReply: messages is empty");
      return fail("LINE send failed", {
        reason: "messages is empty",
      });
    }

    await axios.post(
      `${LINE_API_BASE}/reply`,
      {
        replyToken,
        messages: normalizedMessages,
      },
      {
        headers: buildHeaders(),
        timeout: 10000,
      }
    );

    log("✅ LINE reply sent", {
      messageCount: normalizedMessages.length,
    });

    return success(
      {
        method: "reply",
        replyToken,
        messageCount: normalizedMessages.length,
      },
      "LINE message sent"
    );
  } catch (err) {
    logError("❌ lineSender.sendReply failed", {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
    });

    return fail("LINE send failed", {
      method: "reply",
      status: err.response?.status || null,
      error: err.message,
      responseData: err.response?.data || null,
    });
  }
}

async function sendPush(userId, messages) {
  try {
    const tokenGuard = ensureChannelAccessToken("sendPush");
    if (tokenGuard) return tokenGuard;

    if (!userId) {
      logError("lineSender.sendPush: userId is missing");
      return fail("LINE send failed", {
        reason: "userId is missing",
      });
    }

    const enabledGuard = ensurePushAllowed(userId);
    if (enabledGuard) return enabledGuard;

    const normalizedMessages = normalizeMessages(messages);

    if (normalizedMessages.length === 0) {
      logError("lineSender.sendPush: messages is empty");
      return fail("LINE send failed", {
        reason: "messages is empty",
      });
    }

    await axios.post(
      `${LINE_API_BASE}/push`,
      {
        to: userId,
        messages: normalizedMessages,
      },
      {
        headers: buildHeaders(),
        timeout: 10000,
      }
    );

    log("✅ LINE push sent", {
      userId,
      messageCount: normalizedMessages.length,
    });

    return success(
      {
        method: "push",
        userId,
        messageCount: normalizedMessages.length,
      },
      "LINE message sent"
    );
  } catch (err) {
    logError("❌ lineSender.sendPush failed", {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
    });

    return fail("LINE send failed", {
      method: "push",
      status: err.response?.status || null,
      error: err.message,
      responseData: err.response?.data || null,
    });
  }
}

async function sendBroadcast(messages) {
  try {
    const tokenGuard = ensureChannelAccessToken("sendBroadcast");
    if (tokenGuard) return tokenGuard;

    const enabledGuard = ensureBroadcastAllowed();
    if (enabledGuard) return enabledGuard;

    const normalizedMessages = normalizeMessages(messages);

    if (normalizedMessages.length === 0) {
      logError("lineSender.sendBroadcast: messages is empty");
      return fail("LINE send failed", {
        reason: "messages is empty",
      });
    }

    await axios.post(
      `${LINE_API_BASE}/broadcast`,
      {
        messages: normalizedMessages,
      },
      {
        headers: buildHeaders(),
        timeout: 10000,
      }
    );

    log("✅ LINE broadcast sent", {
      messageCount: normalizedMessages.length,
    });

    return success(
      {
        method: "broadcast",
        messageCount: normalizedMessages.length,
      },
      "LINE message sent"
    );
  } catch (err) {
    logError("❌ lineSender.sendBroadcast failed", {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
    });

    return fail("LINE send failed", {
      method: "broadcast",
      status: err.response?.status || null,
      error: err.message,
      responseData: err.response?.data || null,
    });
  }
}

module.exports = {
  sendReply,
  sendPush,
  sendBroadcast,
};
