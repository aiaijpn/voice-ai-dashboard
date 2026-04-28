"use strict";

const axios = require("axios");
const { log, error: logError } = require("../utils/logger");
const { success, fail } = require("../utils/serviceResponse");

const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;
const LINE_API_BASE = "https://api.line.me/v2/bot/message";

function getAppEnv() {
  return String(process.env.APP_ENV || "production").trim() || "production";
}

function isStagingEnv() {
  return getAppEnv() === "staging";
}

function isEnvEnabled(key) {
  return String(process.env[key] || "").trim().toLowerCase() === "true";
}

function ensureSendEnabled({ method, envKey }) {
  if (!isStagingEnv() || isEnvEnabled(envKey)) {
    return null;
  }

  logError(`lineSender.${method}: ${envKey} is not true in staging`, {
    appEnv: getAppEnv(),
  });

  return fail("LINE send disabled", {
    method,
    reason: `${envKey} is not true in staging`,
    appEnv: getAppEnv(),
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
    const enabledGuard = ensureSendEnabled({
      method: "reply",
      envKey: "LINE_REPLY_ENABLED",
    });
    if (enabledGuard) return enabledGuard;

    if (!CHANNEL_ACCESS_TOKEN) {
      logError("lineSender.sendReply: CHANNEL_ACCESS_TOKEN is missing");
      return fail("LINE send failed", {
        reason: "CHANNEL_ACCESS_TOKEN is missing",
      });
    }

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
    const enabledGuard = ensureSendEnabled({
      method: "push",
      envKey: "LINE_PUSH_ENABLED",
    });
    if (enabledGuard) return enabledGuard;

    if (!CHANNEL_ACCESS_TOKEN) {
      logError("lineSender.sendPush: CHANNEL_ACCESS_TOKEN is missing");
      return fail("LINE send failed", {
        reason: "CHANNEL_ACCESS_TOKEN is missing",
      });
    }

    if (!userId) {
      logError("lineSender.sendPush: userId is missing");
      return fail("LINE send failed", {
        reason: "userId is missing",
      });
    }

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
    const enabledGuard = ensureSendEnabled({
      method: "broadcast",
      envKey: "LINE_BROADCAST_ENABLED",
    });
    if (enabledGuard) return enabledGuard;

    if (!CHANNEL_ACCESS_TOKEN) {
      logError("lineSender.sendBroadcast: CHANNEL_ACCESS_TOKEN is missing");
      return fail("LINE send failed", {
        reason: "CHANNEL_ACCESS_TOKEN is missing",
      });
    }

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
