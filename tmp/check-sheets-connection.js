"use strict";

/**
 * Google Sheets 接続診断スクリプト
 *
 * 目的
 * - GOOGLE_SERVICE_ACCOUNT_JSON が正しいか
 * - Sheets client が作れるか
 *
 * 保存処理までは行わない。
 */

const { checkSheetsConnection } = require("../sheet/saver");

async function main() {
  console.log("=================================");
  console.log("Sheets Connection Check");
  console.log("=================================");

  const result = await checkSheetsConnection();

  console.log(result);

  if (result.success) {
    console.log("\n✅ Sheets API client 作成成功");
  } else {
    console.log("\n❌ Sheets 接続失敗");
  }
}

main().catch((err) => {
  console.error("unexpected error:", err);
});