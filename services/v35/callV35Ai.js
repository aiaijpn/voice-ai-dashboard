"use strict";

/**
 * services/v35/callV35Ai.js
 *
 * 役割:
 * - OpenAI を呼び出す
 * - systemPrompt / userPrompt を渡す
 * - 生テキスト（JSON想定）を取得する
 *
 * このファイルでやること:
 * - OpenAI Responses API 呼び出し
 * - テキスト抽出
 *
 * このファイルでやらないこと:
 * - JSON解析
 * - エラー補正
 * - 業務判断
 */

const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * AI呼び出し
 */
async function callV35Ai(input = {}) {
  const {
    rid = "no_rid",
    systemPrompt = "",
    userPrompt = "",
  } = input;

  try {
    /**
     * モデル指定
     */
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    /**
     * OpenAI 呼び出し
     */
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    /**
     * テキスト抽出（安全に）
     */
    const aiRawText =
      response.output_text ||
      response.output?.[0]?.content?.[0]?.text ||
      "";

    if (!aiRawText) {
      return {
        success: false,
        message: "AI response text empty",
        data: {
          rid,
        },
      };
    }

    return {
      success: true,
      message: "callV35Ai success",
      data: {
        aiRawText,
        model: response.model || model,
        responseId: response.id || "",
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error?.message || "callV35Ai failed",
      data: {
        rid,
      },
    };
  }
}

module.exports = {
  callV35Ai,
};