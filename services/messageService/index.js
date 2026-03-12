"use strict";

const { log, error: logError } = require("../../utils/logger");
const { insertAd } = require("../../ads/adService");
const { success, fail } = require("../../utils/serviceResponse");

const { buildSystemPrompt } = require("./promptBuilder");
const { callOpenAI, OPENAI_MODEL } = require("./openaiClient");
const { parseOpenAIResponse } = require("./responseParser");
const { saveUsage, saveVoiceLog } = require("./logSavers");

log("📦 messageService/index.js loaded:", new Date().toISOString());
log("🔧 ENV CHECK (service/index)");
log(" - OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "OK" : "MISSING");
log(" - OPENAI_MODEL:", process.env.OPENAI_MODEL || "gpt-4o-mini");

async function processMessage(context) {
  const {
    rid = "no_rid",
    bot_id = "voice-ai-dashboard",
    userId = "",
    text = "",
    tone = "polite",
  } = context || {};

  try {
    const systemPrompt = await buildSystemPrompt({
      tone,
      rid,
      log,
    });

    const response = await callOpenAI({
      systemPrompt,
      text,
      rid,
      log,
    });

    await saveUsage({
      response,
      bot_id,
      rid,
      openaiModel: OPENAI_MODEL,
      log,
      logError,
    });

    const { parsed, replyText } = parseOpenAIResponse(response, text, rid, log);

    await saveVoiceLog({
      parsed,
      text,
      rid,
      log,
      logError,
    });

    let finalReply = replyText;
    finalReply = await insertAd(finalReply);

    return success(
      {
        replyText: finalReply,
        summary: parsed?.summary || "",
        category: parsed?.category ?? null,
        urgency_score: parsed?.urgency_score ?? null,
        userId,
        bot_id,
        rid,
      },
      "processMessage ok"
    );
  } catch (e) {
    logError(`❌ [${rid}] processMessage failed:`, e?.message || e);
    return fail(e?.message || "processMessage failed", {
      replyText: "",
      userId,
      bot_id,
      rid,
    });
  }
}

module.exports = {
  processMessage,
};