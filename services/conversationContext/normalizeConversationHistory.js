"use strict";

const {
  normalizeCompanyId,
} = require("../company/companyIdNormalizer");

/**
 * ============================================================
 * normalizeConversationHistory
 * ============================================================
 *
 * 【役割】
 * conversation_history の生データ配列を、
 * 会話文脈エンジン（V35 / conversationContext）が扱いやすい
 * 共通形式へ変換する専用 formatter。
 *
 * この関数は「整えるだけ」であり、
 * 会話の意味判断・company判定・継続判定は絶対に行わない。
 *
 * ------------------------------------------------------------
 * 【このファイルがやること】
 *
 * - 配列でない値を安全に空配列へ変換
 * - キー名の揺れを吸収
 *   例:
 *   - sourceType / source_type / type
 *   - userMessage / user_message
 *   - aiReply / ai_reply
 *   - companyId / company_id
 *   - companyName / company_name
 * - sourceType から role を機械的に変換
 * - text を安全に抽出
 * - 空 text の行を除外
 *
 * ------------------------------------------------------------
 * 【このファイルが絶対にやらないこと】
 *
 * ❌ companyId を推定しない
 * ❌ テーマ継続かどうかを判断しない
 * ❌ topicLabel を決定しない
 * ❌ AI向けの意味解釈をしない
 * ❌ currentCompanyId を補完しない
 * ❌ matchedCompanyId を再判定しない
 *
 * → つまり「意味を決めるな、形だけ整えろ」
 *
 * ------------------------------------------------------------
 * 【出力形式】
 *
 * [
 *   {
 *     role: "user" | "assistant" | "unknown",
 *     text: string,
 *     companyId: string,
 *     companyName: string,
 *     sourceType: string,
 *     timestamp: string,
 *   }
 * ]
 *
 * ------------------------------------------------------------
 * 【設計意図】
 *
 * messageService/index.js を薄く保つために、
 * 履歴整形ロジックを conversationContext 側へ切り出す。
 *
 * 責務分担:
 * - messageService = 取得する
 * - normalizeConversationHistory = 整える
 * - V35 / conversationContext = 解釈・判断する
 *
 * この境界を壊すと、
 * 「入口で少し判断」「V35でもまた判断」の二重構造になり、
 * companyId / topicLabel / 継続判定の齟齬が再発する。
 *
 * ------------------------------------------------------------
 * 【異常検知ルール】
 *
 * 以下の変更を入れたくなったら設計逸脱のサイン:
 *
 * - if 文で意味判断を増やしたくなる
 * - companyId をここで補正したくなる
 * - topicLabel をここで作りたくなる
 * - currentCompanyId をここで決めたくなる
 *
 * → その変更はこのファイルではなく
 *   conversationContext / V35 側で扱うこと。
 *
 * ============================================================
 */

/**
 * null / undefined を安全に空文字へ寄せる
 *
 * @param {any} value
 * @returns {string}
 */
function toSafeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * sourceType から role を機械的に決める
 *
 * 注意:
 * これは「意味判断」ではなく、保存種別を会話表現へ
 * 変換するだけの単純マッピング。
 *
 * @param {string} sourceType
 * @returns {"user" | "assistant" | "unknown"}
 */
function resolveRoleFromSourceType(sourceType = "") {
  const normalized = toSafeString(sourceType);

  if (normalized === "user_message") return "user";

  if (
    normalized === "ai_reply" ||
    normalized === "admin_message"
  ) {
    return "assistant";
  }

  return "unknown";
}

/**
 * 履歴1件から text を抽出する
 *
 * 優先順位:
 * - user系
 * - ai系
 * - 汎用 text/message
 *
 * 注意:
 * ここで「どちらが正しいか」は判断しない。
 * あくまでキー揺れ吸収のみを行う。
 *
 * @param {Object} item
 * @returns {string}
 */
function extractHistoryText(item = {}) {
  return toSafeString(
    item?.userMessage ||
      item?.user_message ||
      item?.aiReply ||
      item?.ai_reply ||
      item?.text ||
      item?.message ||
      ""
  );
}

/**
 * 履歴1件から companyId を抽出する
 *
 * 注意:
 * - companyId の「正しさ」は検証しない
 * - alias 統一や再判定はしない
 * - ここは保存値をそのまま安全に抜くだけ
 *
 * @param {Object} item
 * @returns {string}
 */
function extractCompanyId(item = {}) {
  return normalizeCompanyId(
    toSafeString(
    item?.companyId ||
      item?.company_id ||
      item?.matchedCompanyId ||
      item?.matched_company_id ||
      ""
    )
  );
}

/**
 * 履歴1件から companyName を抽出する
 *
 * @param {Object} item
 * @returns {string}
 */
function extractCompanyName(item = {}) {
  return toSafeString(
    item?.companyName ||
      item?.company_name ||
      item?.matchedCompanyName ||
      item?.matched_company_name ||
      ""
  );
}

/**
 * 履歴1件を共通形式へ変換する
 *
 * @param {Object} item
 * @returns {{
 *   role: "user" | "assistant" | "unknown",
 *   text: string,
 *   companyId: string,
 *   companyName: string,
 *   sourceType: string,
 *   timestamp: string,
 * }}
 */
function normalizeConversationHistoryItem(item = {}) {
  const sourceType = toSafeString(
    item?.sourceType ||
      item?.source_type ||
      item?.type ||
      ""
  );

  const role = resolveRoleFromSourceType(sourceType);
  const text = extractHistoryText(item);
  const companyId = extractCompanyId(item);
  const companyName = extractCompanyName(item);
  const timestamp = toSafeString(item?.timestamp || "");

  return {
    role,
    text,
    companyId,
    companyName,
    sourceType,
    timestamp,
  };
}

/**
 * conversation_history の生配列を
 * 会話文脈用の共通形式へ正規化する
 *
 * @param {any[]} items
 * @returns {Array<{
 *   role: "user" | "assistant" | "unknown",
 *   text: string,
 *   companyId: string,
 *   companyName: string,
 *   sourceType: string,
 *   timestamp: string,
 * }>}
 */
function normalizeConversationHistory(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => normalizeConversationHistoryItem(item))
    .filter((item) => item.text);
}

module.exports = {
  normalizeConversationHistory,
  normalizeConversationHistoryItem,
};
