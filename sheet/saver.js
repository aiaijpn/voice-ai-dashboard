"use strict";

/**
 * ADR-007 / ADR-008 用
 * Google Sheets 保存共通部品
 *
 * このファイルの目的:
 * - Google Sheets 認証情報を取得する
 * - Sheets API client を生成する
 * - 「接続できるか」を事前確認できるようにする
 * - 「対象スプレッドシート / 対象シートに到達できるか」を確認できるようにする
 * - 1行 append を共通処理として提供する
 *
 * なぜここまで分けるのか:
 * - 今回のように「保存処理」まで進んでから止まると、切り分けが遅い
 * - 停滞点をなくすには
 *
 *   1. 認証OKか
 *   2. Sheets client生成OKか
 *   3. spreadsheetId に到達できるか
 *   4. sheetName が存在するか
 *   5. append が成功するか
 *
 *   を段階分離したほうがよい
 *
 * このファイルの責務:
 * - 外部I/O（Google Sheets）だけ
 *
 * このファイルでやらないこと:
 * - userMessage / aiReply の意味づけ
 * - 保存データの業務判断
 * - どのデータを保存するかの決定
 *
 * それらは repository / service 側の責務。
 */

const { google } = require("googleapis");
const { log, error: logError } = require("../utils/logger");

/**
 * Service Account 認証情報を取得する
 *
 * 対応環境:
 * - 本番（Renderなど）: GOOGLE_SERVICE_ACCOUNT_JSON を使用
 * - ローカル: GOOGLE_SERVICE_ACCOUNT_FILE を使用
 *
 * 優先順位:
 * 1. GOOGLE_SERVICE_ACCOUNT_JSON（1行JSON文字列）
 * 2. GOOGLE_SERVICE_ACCOUNT_FILE（JSONファイルパス）
 *
 * 例（JSON）:
 * {
 *   "type": "service_account",
 *   "project_id": "...",
 *   ...
 * }
 *
 * 例（.env ローカル）:
 * GOOGLE_SERVICE_ACCOUNT_FILE=./service-account.json
 *
 * 契約:
 * - 両方未設定なら throw
 * - JSON不正でも throw
 * - ファイルが存在しない場合も throw
 *
 * 注意:
 * - private_key に含まれる "\\n" は改行に変換する
 *
 * この関数の責務:
 * - 認証情報の取得と正規化のみ
 * - API接続確認は行わない
 */
function getServiceAccountJson() {
  const fs = require("fs");
  const path = require("path");

  const rawJson = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();
  const filePath = String(process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "").trim();

  // ① 本番（JSON）
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);

      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
      }

      return parsed;
    } catch (error) {
      throw new Error(
        `sheet/saver.getServiceAccountJson: invalid JSON: ${error.message}`
      );
    }
  }

  // ② ローカル（FILE）
  if (filePath) {
    const resolvedPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(
        `sheet/saver.getServiceAccountJson: service account file not found: ${resolvedPath}`
      );
    }

    const raw = fs.readFileSync(resolvedPath, "utf8");

    try {
      const parsed = JSON.parse(raw);

      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
      }

      return parsed;
    } catch (error) {
      throw new Error(
        `sheet/saver.getServiceAccountJson: invalid JSON (file): ${error.message}`
      );
    }
  }

  throw new Error(
    "sheet/saver.getServiceAccountJson: GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE is required"
  );
}

/**
 * Google Sheets API client を生成する
 *
 * 契約:
 * - 認証情報が正しければ client を返す
 * - 失敗時は throw
 *
 * 注意:
 * - ここで client が作れても、
 *   spreadsheetId が読める保証まではない
 * - つまり「認証情報の形式」と「client生成」の確認段階
 */
function createSheetsClient() {
  const serviceAccount = getServiceAccountJson();

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({
    version: "v4",
    auth,
  });
}

/**
 * Sheets API client 生成まで成功するか確認する
 *
 * 目的:
 * - 開発時に「認証JSONは壊れていないか」を先に確認する
 * - append まで行かずに、接続の前段だけ切り分ける
 *
 * ここで確認すること:
 * - GOOGLE_SERVICE_ACCOUNT_JSON が存在するか
 * - JSON parse できるか
 * - Sheets client が生成できるか
 *
 * ここで確認しないこと:
 * - spreadsheetId の実在
 * - シート名の存在
 *
 * @returns {Promise<{success:boolean,message:string,data:any}>}
 */
async function checkSheetsConnection() {
  try {
    const sheets = createSheetsClient();

    log("sheet/saver.checkSheetsConnection ok", {
      hasClient: !!sheets,
    });

    return {
      success: true,
      message: "sheet/saver.checkSheetsConnection: ok",
      data: {
        hasClient: !!sheets,
      },
    };
  } catch (error) {
    logError("sheet/saver.checkSheetsConnection failed", {
      message: error.message,
      stack: error.stack,
    });

    return {
      success: false,
      message: `sheet/saver.checkSheetsConnection: ${error.message}`,
      data: null,
    };
  }
}

/**
 * 指定 spreadsheetId / sheetName にアクセス可能か確認する
 *
 * 目的:
 * - 保存前に「このスプレッドシートに届くか」を確認する
 * - 必要なら「このシート名が存在するか」まで確認する
 *
 * 確認手順:
 * 1. spreadsheetId 必須チェック
 * 2. client 生成
 * 3. spreadsheets.get でスプレッドシートの metadata を読む
 * 4. sheetName が指定されていれば、そのシートが存在するか確認
 *
 * ここで分かること:
 * - 認証自体がダメ
 * - spreadsheetId が違う
 * - 権限がない
 * - sheetName が存在しない
 *
 * @param {Object} params
 * @param {string} params.spreadsheetId
 * @param {string} [params.sheetName]
 * @returns {Promise<{success:boolean,message:string,data:any}>}
 */
async function checkSpreadsheetAccess({ spreadsheetId, sheetName }) {
  const safeSpreadsheetId = String(spreadsheetId || "").trim();
  const safeSheetName = String(sheetName || "").trim();

  try {
    if (!safeSpreadsheetId) {
      throw new Error(
        "sheet/saver.checkSpreadsheetAccess: spreadsheetId is required"
      );
    }

    const sheets = createSheetsClient();

    log("sheet/saver.checkSpreadsheetAccess start", {
      spreadsheetId: safeSpreadsheetId,
      sheetName: safeSheetName || "(not specified)",
    });

    const response = await sheets.spreadsheets.get({
      spreadsheetId: safeSpreadsheetId,
    });

    const spreadsheetTitle =
      response?.data?.properties?.title || "(unknown spreadsheet title)";

    const sheetTitles = Array.isArray(response?.data?.sheets)
      ? response.data.sheets.map((sheet) => sheet?.properties?.title || "")
      : [];

    /**
     * sheetName 指定がある場合のみ存在確認
     */
    if (safeSheetName) {
      const exists = sheetTitles.includes(safeSheetName);

      if (!exists) {
        throw new Error(
          `sheet/saver.checkSpreadsheetAccess: sheet "${safeSheetName}" was not found`
        );
      }
    }

    log("sheet/saver.checkSpreadsheetAccess ok", {
      spreadsheetId: safeSpreadsheetId,
      spreadsheetTitle,
      sheetName: safeSheetName || "(not specified)",
      sheetCount: sheetTitles.length,
    });

    return {
      success: true,
      message: "sheet/saver.checkSpreadsheetAccess: ok",
      data: {
        spreadsheetId: safeSpreadsheetId,
        spreadsheetTitle,
        sheetName: safeSheetName || null,
        sheetTitles,
      },
    };
  } catch (error) {
    logError("sheet/saver.checkSpreadsheetAccess failed", {
      message: error.message,
      stack: error.stack,
      spreadsheetId: safeSpreadsheetId,
      sheetName: safeSheetName,
    });

    return {
      success: false,
      message: `sheet/saver.checkSpreadsheetAccess: ${error.message}`,
      data: null,
    };
  }
}

/**
 * Google Sheets に 1行 append する
 *
 * @param {Object} params
 * @param {string} params.spreadsheetId - 保存先スプレッドシートID
 * @param {string} params.sheetName - 保存先シート名
 * @param {Array} params.values - 1行分の配列
 *
 * 契約:
 * - 成功時は { success: true, ... } を返す
 * - 失敗時は throw する
 *
 * なぜ throw するか:
 * - repository / service 側で失敗を明示的に扱うため
 * - 外部I/O失敗を「成功に見せない」ため
 *
 * 重要:
 * - values は「1行の配列」
 * - API requestBody では [values] として2次元配列化する
 */
async function appendRowToSheet({ spreadsheetId, sheetName, values }) {
  const safeSpreadsheetId = String(spreadsheetId || "").trim();
  const safeSheetName = String(sheetName || "").trim();

  if (!safeSpreadsheetId) {
    throw new Error("sheet/saver.appendRowToSheet: spreadsheetId is required");
  }

  if (!safeSheetName) {
    throw new Error("sheet/saver.appendRowToSheet: sheetName is required");
  }

  if (!Array.isArray(values)) {
    throw new Error("sheet/saver.appendRowToSheet: values must be an array");
  }

  log("sheet/saver.appendRowToSheet start", {
    spreadsheetId: safeSpreadsheetId,
    sheetName: safeSheetName,
    valueCount: values.length,
  });

  try {
    const sheets = createSheetsClient();

    await sheets.spreadsheets.values.append({
      spreadsheetId: safeSpreadsheetId,
      range: `${safeSheetName}!A1:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [values],
      },
    });

    log("sheet/saver.appendRowToSheet success", {
      spreadsheetId: safeSpreadsheetId,
      sheetName: safeSheetName,
      valueCount: values.length,
    });

    return {
      success: true,
      message: "sheet/saver.appendRowToSheet: appended",
      data: {
        spreadsheetId: safeSpreadsheetId,
        sheetName: safeSheetName,
      },
    };
  } catch (error) {
    logError("sheet/saver.appendRowToSheet failed", {
      message: error.message,
      stack: error.stack,
      spreadsheetId: safeSpreadsheetId,
      sheetName: safeSheetName,
    });

    throw new Error(`sheet/saver.appendRowToSheet failed: ${error.message}`);
  }
}

module.exports = {
  getServiceAccountJson,
  createSheetsClient,
  checkSheetsConnection,
  checkSpreadsheetAccess,
  appendRowToSheet,
};