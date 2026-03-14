"use strict";

/**
 * Conversation History 保存用 Repository
 *
 * 役割:
 * - 会話履歴1件を「Google Sheets に保存できる1行配列」に変換する
 * - sheet/saver へ保存処理を委譲する
 *
 * このファイルの責務:
 * - 会話履歴データを Sheets 用の列順に並べる
 * - 保存先シート名を固定する
 * - saver の成功/失敗を serviceResponse 契約で返す
 *
 * このファイルでやらないこと:
 * - 入力値の業務判断
 * - 必須項目の本格検証
 * - userMessage / aiReply の生成
 * - unresolvedQ の判定
 *
 * それらは service 層の責務。
 */

const { appendRowToSheet } = require("../sheet/saver");
const { success, fail } = require("../utils/serviceResponse");

/**
 * 保存先スプレッドシートID
 *
 * ADR-007 の保存契約に従い、
 * spreadsheetId は環境変数から受け取る。
 */
const SPREADSHEET_ID = String(process.env.SPREADSHEET_ID || "").trim();

/**
 * ADR-008 で定義した保存先シート名
 */
const CONVERSATION_SHEET_NAME = "conversation_history";

/**
 * 会話履歴オブジェクトを
 * Google Sheets に append するための「1行配列」に変換する。
 *
 * 列順は ADR-008 に固定:
 * 1. timestamp
 * 2. bot_id
 * 3. user_id
 * 4. user_message
 * 5. ai_reply
 * 6. operator_memo
 * 7. manual_send
 * 8. source_type
 * 9. unresolved_q
 *
 * 重要:
 * - この列順を崩すと、保存は成功しても意味が壊れる
 * - ADR-008 の中核はこの列順固定にある
 *
 * @param {Object} input
 * @returns {Array}
 */
function buildConversationRow(input = {}) {
  return [
    // 1. 保存時刻
    input.timestamp || "",

    // 2. bot識別子
    input.botId || "",

    // 3. LINEユーザID
    input.userId || "",

    // 4. ユーザ発言
    input.userMessage || "",

    // 5. AI応答
    input.aiReply || "",

    // 6. 管理者メモ
    input.operatorMemo || "",

    // 7. 手動送信フラグ
    // boolean 以外は false に寄せる
    typeof input.manualSend === "boolean" ? input.manualSend : false,

    // 8. ソース種別
    // 未指定時は通常メッセージとして扱う
    input.sourceType || "message",

    // 9. 未解決質問フラグ
    // boolean 以外は false に寄せる
    typeof input.unresolvedQ === "boolean" ? input.unresolvedQ : false,
  ];
}

/**
 * 会話履歴を conversation_history シートへ 1行 append する
 *
 * @param {Object} input
 * @returns {Promise<{success:boolean,message:string,data:any}>}
 *
 * 契約:
 * - 成功時: success(...)
 * - 失敗時: fail(...)
 *
 * 重要:
 * - saver 側は失敗時 throw する契約
 * - したがって、この repository で try/catch し、
 *   上位が扱いやすい fail(...) に変換する
 */
async function appendConversationRow(input = {}) {
  try {
    /**
     * 保存先 spreadsheetId は必須。
     * なければ外部保存不能なのでここで fail にする。
     */
    if (!SPREADSHEET_ID) {
      return fail(
        "conversationRepository.appendConversationRow: SPREADSHEET_ID is required"
      );
    }

    /**
     * 会話履歴オブジェクトを
     * Sheets 用の1行配列に変換する。
     */
    const values = buildConversationRow(input);

    /**
     * 実際の Google Sheets append は
     * 外部I/O責務である sheet/saver に委譲する。
     */
    const result = await appendRowToSheet({
      spreadsheetId: SPREADSHEET_ID,
      sheetName: CONVERSATION_SHEET_NAME,
      values,
    });

    /**
     * success(data, message) 契約に合わせて返却する。
     *
     * data には、後でデバッグしやすいよう
     * シート名 / 保存配列 / saver結果を含める。
     */
    return success(
      {
        sheetName: CONVERSATION_SHEET_NAME,
        values,
        sheetResult: result.data || null,
      },
      "conversationRepository.appendConversationRow: row appended"
    );
  } catch (error) {
    /**
     * saver は失敗時に throw するため、
     * repository では fail(...) に包み直して返す。
     *
     * これにより service 層は
     * success / fail 契約だけ見ればよくなる。
     */
    return fail(
      `conversationRepository.appendConversationRow: ${error.message}`
    );
  }
}

module.exports = {
  CONVERSATION_SHEET_NAME,
  buildConversationRow,
  appendConversationRow,
};