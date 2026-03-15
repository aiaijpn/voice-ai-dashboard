"use strict";

const axios = require("axios");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/**
 * OpenAI Responses API 呼び出し
 *
 * ADR-011:
 * messages をそのまま OpenAI input に変換する
 */
async function callOpenAI({
  systemPrompt,
  text,
  messages,
  rid = "no_rid",
  log,
}) {
  log(`🤖 [${rid}] (openaiClient) calling OpenAI...`);

  /**
   * messages が来ていればそれを優先
   * 無ければ従来の system + user で動作
   */
  let inputMessages;

  if (Array.isArray(messages) && messages.length > 0) {
    inputMessages = messages.map((m) => ({
      role: m.role,
      content: [{ type: "input_text", text: String(m.content || "") }],
    }));
  } else {
    inputMessages = [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: String(text || "") }],
      },
    ];
  }

  const response = await axios.post(
    "https://api.openai.com/v1/responses",
    {
      model: OPENAI_MODEL,

      input: inputMessages,

      text: {
        format: {
          type: "json_schema",
          name: "voice_analysis",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              reply_text: { type: "string" },
              summary: { type: "string" },
              category: { type: "number" },
              urgency_score: { type: "number" },
            },
            required: ["reply_text", "summary", "category", "urgency_score"],
          },
        },
      },
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  log(`✅ [${rid}] (openaiClient) OpenAI response received`);

  return response;
}

module.exports = {
  callOpenAI,
  OPENAI_MODEL,
};