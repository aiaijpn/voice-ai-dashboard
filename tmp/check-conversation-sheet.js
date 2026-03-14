"use strict";

/**
 * Google Sheets スプレッドシート到達診断
 *
 * 確認すること
 * 1 認証OKか
 * 2 spreadsheetId 読めるか
 * 3 シート名が存在するか
 */

const { checkSpreadsheetAccess } = require("../sheet/saver");

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = "conversation_history";

async function main() {
  console.log("=================================");
  console.log("Spreadsheet Access Check");
  console.log("=================================");

  console.log("spreadsheetId:", SPREADSHEET_ID);
  console.log("sheetName:", SHEET_NAME);

  const result = await checkSpreadsheetAccess({
    spreadsheetId: SPREADSHEET_ID,
    sheetName: SHEET_NAME,
  });

  console.log(result);

  if (result.success) {
    console.log("\n✅ Spreadsheet access OK");
  } else {
    console.log("\n❌ Spreadsheet access NG");
  }
}

main().catch((err) => {
  console.error("unexpected error:", err);
});