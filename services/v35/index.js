"use strict";

/**
 * services/v35/index.js
 *
 * V3.5 会話エンジンの司令塔
 *
 * 役割:
 * - V3.5全体フローを順番に実行する
 * - context収集
 * - prompt生成
 * - AI呼び出し
 * - AI返却JSON解析
 * - action適用
 *
 * このファイルでやらないこと:
 * - company_wiki 候補抽出の詳細実装
 * - prompt文面の詳細定義
 * - OpenAI APIの詳細実装
 * - JSONの細かい補正
 * - question_stock保存の詳細実装
 *
 * それぞれ専用ファイルへ委譲する。
 */

const { collectV35Context } = require("./collectV35Context");
const { buildV35Prompt } = require("./buildV35Prompt");
const { callV35Ai } = require("./callV35Ai");
const { parseV35Response } = require("./parseV35Response");
const { applyV35Actions } = require("./applyV35Actions");

/**
 * V3.5 メイン処理
 *
 * @param {Object} input
 * @param {string} input.rid
 * @param {string} input.bot_id
 * @param {string} input.userId
 * @param {string} input.userMessage
 * @returns {Promise<{success:boolean,message:string,data:any}>}
 */
async function runV35(input = {}) {
  const safeInput = {
    rid: String(input.rid || "no_rid"),
    bot_id: String(input.bot_id || "voice-ai-dashboard"),
    userId: String(input.userId || ""),
    userMessage: String(input.userMessage || ""),
  };

  try {
    /**
     * 1. 入力素材収集
     */
    const contextResult = await collectV35Context(safeInput);
    if (!contextResult?.success) {
      return {
        success: false,
        message: contextResult?.message || "collectV35Context failed",
        data: contextResult?.data || null,
      };
    }

    /**
     * 2. AI prompt 生成
     */
    const promptResult = buildV35Prompt({
      ...safeInput,
      ...contextResult.data,
    });

    if (!promptResult?.success) {
      return {
        success: false,
        message: promptResult?.message || "buildV35Prompt failed",
        data: promptResult?.data || null,
      };
    }

    /**
     * 3. OpenAI 呼び出し
     */
    const aiResult = await callV35Ai({
      ...safeInput,
      ...contextResult.data,
      ...promptResult.data,
    });

    if (!aiResult?.success) {
      return {
        success: false,
        message: aiResult?.message || "callV35Ai failed",
        data: aiResult?.data || null,
      };
    }

    /**
     * 4. AI返却JSON解析
     *
     * 重要:
     * - parseV35Response には context を必ず渡す
     * - companyCandidates / currentCompanyId を使って
     *   matchedCompanyId の検証・補完を行うため
     */
    const parsedResult = parseV35Response({
      ...safeInput,
      aiRawText: aiResult.data?.aiRawText || "",
      context: contextResult.data || {},
    });

    if (!parsedResult?.success) {
      return {
        success: false,
        message: parsedResult?.message || "parseV35Response failed",
        data: parsedResult?.data || null,
      };
    }

    /**
     * 5. 保存処理 + 最終返信生成
     */
    const actionResult = await applyV35Actions({
      ...safeInput,
      ...contextResult.data,
      parsed: parsedResult.data?.parsed || null,
    });

    if (!actionResult?.success) {
      return {
        success: false,
        message: actionResult?.message || "applyV35Actions failed",
        data: actionResult?.data || null,
      };
    }

    return {
      success: true,
      message: "runV35 success",
      data: actionResult.data || null,
    };
  } catch (error) {
    return {
      success: false,
      message: error?.message || "runV35 failed",
      data: {
        rid: safeInput.rid,
        bot_id: safeInput.bot_id,
        userId: safeInput.userId,
      },
    };
  }
}

module.exports = {
  runV35,
};