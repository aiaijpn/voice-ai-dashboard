"use strict";

/**
 * answerRuleHandler
 *
 * 役割:
 * - V3.1 の「回答優先ルール層」を担当する
 * - ユーザー発話に対して answerRule を照合する
 * - ヒットした場合は OpenAI を呼ばずに即返しする
 * - 即返し時でも会話履歴は通常どおり保存する
 *
 * 位置づけ:
 * - messageService/index.js から呼ばれる下位ハンドラ
 * - index.js を肥大化させないために分離する
 *
 * 方針:
 * - 初期版は「確実性優先」
 * - AI に解釈させず preferred_answer をそのまま返す
 * - 返答ルールにヒットしなければ null を返して通常フローへ戻す
 * - ここでは voiceLog 保存や classify は行わない
 *
 * 返り値:
 * - ヒット時:
 *   {
 *     handled: true,
 *     response: success(...) の返却値
 *   }
 *
 * - 非ヒット時:
 *   {
 *     handled: false,
 *     response: null
 *   }
 */

const { success } = require("../../utils/serviceResponse");
const { findAnswerRule } = require("../answerRuleService");
const {
  saveConversationHistory,
} = require("../historyService");
const {
  buildProcessMessageSuccessData,
} = require("./buildReply");

/**
 * 回答優先ルールにヒットした場合の処理
 *
 * ここでやること:
 * 1. userText を見て answerRule を検索
 * 2. ヒットしなければ handled:false を返す
 * 3. ヒットしたら preferred_answer をそのまま採用
 * 4. 会話履歴を user / ai の両方保存
 * 5. successレスポンスを組み立てて返す
 *
 * ここでやらないこと:
 * - OpenAI呼び出し
 * - AIレスポンス解析
 * - AI分類
 * - voiceLog保存
 *
 * @param {Object} input
 * @param {string} input.rid
 * @param {string} input.bot_id
 * @param {string} input.userId
 * @param {string} input.text
 * @param {string} input.aiInputText
 * @param {Function} input.log
 * @param {Function} input.logError
 * @returns {Promise<{handled: boolean, response: Object|null}>}
 */
async function handleAnswerRule(input = {}) {
  const rid = String(input.rid || "no_rid");
  const bot_id = String(input.bot_id || "voice-ai-dashboard");
  const userId = String(input.userId || "");
  const text = String(input.text || "");
  const aiInputText = String(input.aiInputText || "");
  const log = typeof input.log === "function" ? input.log : console.log;
  const logError =
    typeof input.logError === "function" ? input.logError : console.error;

  /**
   * AI入力専用テキストがあればそれを優先
   * 無ければ生発言 text を使う
   *
   * ADR014 / ADR016 の流れに合わせる
   */
  const effectiveAiInputText = aiInputText || text;

  /**
   * 1. 回答優先ルール検索
   */
  const matchedRule = findAnswerRule(effectiveAiInputText);

  /**
   * 非ヒットなら通常AIフローへ戻す
   */
  if (!matchedRule) {
    log(`🟡 [${rid}] answerRule not matched`);

    return {
      handled: false,
      response: null,
    };
  }

  /**
   * 2. ヒット時ログ
   */
  log(`🟢 [${rid}] answerRule matched`, {
    ruleId: matchedRule.id,
    linkedCompanyId: matchedRule.linked_company_id || "",
    questionExample: matchedRule.question_example || "",
  });

  /**
   * 3. 優先返答をそのまま採用
   *
   * 初期版は AI を通さない。
   * これにより「こちらが返してほしい答え」を確実に出す。
   */
  const finalReply = String(matchedRule.preferred_answer || "").trim();

  /**
   * preferred_answer が空なら安全のため通常フローへ戻す
   * （データ不備に耐える）
   */
  if (!finalReply) {
    logError(`❌ [${rid}] answerRule preferred_answer missing`, {
      ruleId: matchedRule.id,
    });

    return {
      handled: false,
      response: null,
    };
  }

  /**
   * 4. 会話履歴保存
   *
   * 方針:
   * - 即返しでも user / ai の両方を保存する
   * - 後続の会話文脈が途切れないようにする
   */
  await saveConversationHistory({
    botId: bot_id,
    userId,
    userMessage: text,
    sourceType: "user_message",
  });

  await saveConversationHistory({
    botId: bot_id,
    userId,
    aiReply: finalReply,
    sourceType: "ai_reply",
  });

  /**
   * 5. 最終レスポンス組み立て
   *
   * parsed は今回は最小でよい。
   * 後で必要になれば ruleId などを増やしてもよい。
   */
  const response = success(
    buildProcessMessageSuccessData({
      finalReply,
      parsed: {
        reply_text: finalReply,
        summary: "",
        category: 0,
        urgency_score: 1,
      },
      userId,
      bot_id,
      rid,
    }),
    "processMessage ok (answer rule)"
  );

  /**
   * 6. 即返し完了
   */
  return {
    handled: true,
    response,
  };
}

module.exports = {
  handleAnswerRule,
};