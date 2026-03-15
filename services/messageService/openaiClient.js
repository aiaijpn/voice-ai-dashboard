"use strict";

/**
 * openaiClient
 *
 * 役割:
 * - OpenAI Responses API を呼び出す
 * - messageService から受け取った messages を
 *   OpenAI 送信用 input へ整形する
 *
 * 重要:
 * - ADR-011 では「会話履歴を messages に載せて OpenAI に渡す」
 * - ただし Responses API の content は
 *   配列 + input_text ではなく
 *   文字列で渡す
 *
 * 今回の不具合原因:
 * - content: [{ type: "input_text", text: "..." }]
 *   という形式で送っていた
 * - その結果、本番で 400 invalid_value が発生した
 *
 * 修正方針:
 * - content は必ず string にする
 * - messages があればそれを優先
 * - messages が無ければ従来の systemPrompt + text で fallback
 */

const axios = require("axios");

/**
 * 環境変数
 *
 * OPENAI_API_KEY:
 * - OpenAI API キー
 *
 * OPENAI_MODEL:
 * - 未指定時は gpt-4o-mini
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/**
 * 1件の message を
 * Responses API 用の input item に変換する
 *
 * 入力例:
 * {
 *   role: "user",
 *   content: "こんにちは"
 * }
 *
 * 出力例:
 * {
 *   role: "user",
 *   content: "こんにちは"
 * }
 *
 * 重要:
 * - content は string 固定
 * - role はそのまま使う
 * - 空でも String(...) で安全に文字列化
 *
 * @param {Object} message
 * @returns {{role:string, content:string}}
 */
function mapMessageToResponseInput(message = {}) {
  return {
    role: String(message.role || "user"),
    content: String(message.content || ""),
  };
}

/**
 * OpenAI へ送る input 配列を構築する
 *
 * 優先順位:
 * 1. messages が配列で1件以上ある → それを使う
 * 2. 無ければ systemPrompt + text の fallback
 *
 * ADR-011:
 * - index.js 側で
 *   system + history + current user
 *   の順で messages を組み立てる
 * - この関数はそれを OpenAI 用に素直に変換するだけ
 *
 * @param {Object} input
 * @param {Array} input.messages
 * @param {string} input.systemPrompt
 * @param {string} input.text
 * @returns {Array}
 */
function buildOpenAIInput(input = {}) {
  const messages = Array.isArray(input.messages) ? input.messages : [];
  const systemPrompt = String(input.systemPrompt || "");
  const text = String(input.text || "");

  /**
   * messages 優先
   *
   * ここで role / content を最低限整形する。
   */
  if (messages.length > 0) {
    return messages.map(mapMessageToResponseInput);
  }

  /**
   * fallback:
   * 従来実装との互換用
   *
   * まだ messages を渡さない箇所があっても
   * system + user で最低限動くようにしておく
   */
  return [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: text,
    },
  ];
}

/**
 * OpenAI Responses API を呼び出す
 *
 * @param {Object} input
 * @param {string} input.systemPrompt
 * @param {string} input.text
 * @param {Array} input.messages
 * @param {string} input.rid
 * @param {Function} input.log
 * @returns {Promise<any>}
 */
async function callOpenAI({
  systemPrompt,
  text,
  messages,
  rid = "no_rid",
  log = console.log,
}) {
  /**
   * APIキー未設定は即エラー
   *
   * ここで落とすことで、
   * axios まで行って分かりにくい失敗になるのを防ぐ
   */
  if (!OPENAI_API_KEY) {
    throw new Error("openaiClient.callOpenAI: OPENAI_API_KEY is required");
  }

  /**
   * OpenAI 送信用 input を構築
   */
  const inputMessages = buildOpenAIInput({
    systemPrompt,
    text,
    messages,
  });

  log(`🤖 [${rid}] (openaiClient) calling OpenAI...`, {
    model: OPENAI_MODEL,
    inputCount: inputMessages.length,
  });

  try {
    /**
     * Responses API 呼び出し
     *
     * 重要:
     * - input は messages 配列
     * - content は string
     * - text.format は既存の json_schema を維持
     */
    const response = await axios.post(
      "https://api.openai.com/v1/responses",
      {
        model: OPENAI_MODEL,

        /**
         * ADR-011:
         * system + history + current user
         * がここに入る
         */
        input: inputMessages,

        /**
         * 出力フォーマット
         *
         * 既存の responseParser 側と合わせるため
         * voice_analysis schema を維持する
         */
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
              required: [
                "reply_text",
                "summary",
                "category",
                "urgency_score",
              ],
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
  } catch (error) {
    /**
     * 失敗時は、原因特定しやすいよう
     * status と response.data を必ず出す
     *
     * Render / ローカル双方で効く
     */
    log(`❌ [${rid}] (openaiClient) OpenAI request failed`);

    if (error.response) {
      log(`❌ [${rid}] (openaiClient) status: ${error.response.status}`);
      log(
        `❌ [${rid}] (openaiClient) response data: ${JSON.stringify(
          error.response.data
        )}`
      );
    } else {
      log(
        `❌ [${rid}] (openaiClient) no response: ${error.message || error}`
      );
    }

    throw error;
  }
}

/**
 * export
 */
module.exports = {
  callOpenAI,
  OPENAI_MODEL,
  mapMessageToResponseInput,
  buildOpenAIInput,
};