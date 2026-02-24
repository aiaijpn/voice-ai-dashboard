const axios = require("axios");
const { appendRow } = require("../sheet/saver");

console.log("handler.js version: 2026-02-24-01");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const handleEvent = async (event) => {
  if (event.type !== "message" || event.message.type !== "text") {
    return;
  }

  const userText = event.message.text;

  try {
    // ===== OpenAI Structured Output =====
    const response = await axios.post(
      "https://api.openai.com/v1/responses",
      {
        model: OPENAI_MODEL,
        input: userText,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "voice_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                reply_text: { type: "string" },
                summary: { type: "string" },
                category: { type: "number" },
                urgency_score: { type: "number" }
              },
              required: ["reply_text", "summary", "category", "urgency_score"]
            }
          }
        }
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const parsed = JSON.parse(response.data.output[0].content[0].text);

    // ===== Google Sheets 保存 =====
    await appendRow({
      timestamp: new Date().toISOString(),
      user_text: userText,
      summary: parsed.summary,
      category: parsed.category,
      urgency_score: parsed.urgency_score,
      reply_text: parsed.reply_text
    });

    console.log("Sheet append success");

    // ===== LINE返信 =====
    await axios.post(
      "https://api.line.me/v2/bot/message/reply",
      {
        replyToken: event.replyToken,
        messages: [
          {
            type: "text",
            text: parsed.reply_text
          }
        ]
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}`
        }
      }
    );

  } catch (error) {
    console.error("Handler error:", error.response?.data || error.message);
  }
};

module.exports = { handleEvent };

