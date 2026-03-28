"use strict";

require("dotenv").config();

const { processMessage } = require("../services/messageService");
const {
  getAllQuestionStockRows,
  findExistingStockRow,
} = require("../services/questionStockService");
const { normalizeText } = require("../utils/textMatch");
const { google } = require("googleapis");

function line(title = "") {
  console.log("\n=================================");
  console.log(title);
  console.log("=================================");
}

/**
 * questionStockService と同じ認証方針で Sheets client を作る
 * - 本番: GOOGLE_SERVICE_ACCOUNT_JSON
 * - ローカル: GOOGLE_SERVICE_ACCOUNT_FILE
 */
function createSheetsClient() {
  const fs = require("fs");
  const path = require("path");

  const filePath = String(process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "").trim();
  const rawJson = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();

  let credentials = null;

  if (rawJson) {
    credentials = JSON.parse(rawJson);
  } else if (filePath) {
    const resolvedPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Service account file not found: ${resolvedPath}`);
    }

    credentials = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  } else {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE is required"
    );
  }

  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

async function main() {
  /**
   * 使い方:
   * node test/test-processMessage-questionStock-v3.3.js
   * node test/test-processMessage-questionStock-v3.3.js "駐車場はありますか"
   * node test/test-processMessage-questionStock-v3.3.js "v3.3 実機共通テスト 001" 2
   */

  const text =
    process.argv[2] ||
    `v3.3共通テスト質問 ${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const repeatCount = Number(process.argv[3] || 2);

  if (!Number.isInteger(repeatCount) || repeatCount < 1) {
    throw new Error("repeatCount must be an integer >= 1");
  }

  const ridBase = `test-v33-${Date.now()}`;
  const normalizedQuestion = normalizeText(text);
  const companyId = "";

  line("Input");
  console.log("text               =", text);
  console.log("normalizedQuestion =", normalizedQuestion);
  console.log("repeatCount        =", repeatCount);
  console.log("companyId          =", companyId || "(empty)");

  const sheets = createSheetsClient();

  line("Before");
  const beforeRows = await getAllQuestionStockRows(sheets);
  const beforeMatch = findExistingStockRow(
    beforeRows,
    companyId,
    normalizedQuestion
  );

  console.log(
    "beforeMatch =",
    beforeMatch
      ? {
          sheetRowNumber: beforeMatch.sheetRowNumber,
          company_id: beforeMatch.company_id,
          normalized_question: beforeMatch.normalized_question,
          asked_count: beforeMatch.asked_count,
          first_asked_at: beforeMatch.first_asked_at,
          last_asked_at: beforeMatch.last_asked_at,
        }
      : null
  );

  line("Run processMessage()");
  for (let i = 1; i <= repeatCount; i += 1) {
    const rid = `${ridBase}-${i}`;

    const result = await processMessage({
      rid,
      bot_id: "voice-ai-dashboard",
      userId: "test-user",
      text,
      aiInputText: text,
      tone: "polite",
    });

    console.log(`run[${i}] result =`, result);
  }

  line("After");
  const afterRows = await getAllQuestionStockRows(sheets);
  const afterMatch = findExistingStockRow(
    afterRows,
    companyId,
    normalizedQuestion
  );

  console.log(
    "afterMatch =",
    afterMatch
      ? {
          sheetRowNumber: afterMatch.sheetRowNumber,
          company_id: afterMatch.company_id,
          normalized_question: afterMatch.normalized_question,
          asked_count: afterMatch.asked_count,
          first_asked_at: afterMatch.first_asked_at,
          last_asked_at: afterMatch.last_asked_at,
        }
      : null
  );

  line("Judge");

  if (!afterMatch) {
    console.log("NG: question_stock に対象レコードが見つかりません");
    console.log("考えられる原因:");
    console.log("- answerRule で早期 return");
    console.log("- companyWiki で早期 return");
    console.log("- processMessage から saveQuestionStock が呼ばれていない");
    console.log("- saveQuestionStock に渡すキー名がズレている");
    return;
  }

  const beforeCount = beforeMatch ? Number(beforeMatch.asked_count || 0) : 0;
  const afterCount = Number(afterMatch.asked_count || 0);
  const diff = afterCount - beforeCount;

  console.log("beforeCount =", beforeCount);
  console.log("afterCount  =", afterCount);
  console.log("diff        =", diff);

  if (diff === repeatCount) {
    console.log("OK: processMessage 経由で question_stock が期待どおり動作しています");
  } else {
    console.log("NG: asked_count の増分が期待と一致しません");
  }
}

main().catch((error) => {
  console.error("unexpected error:", error);
  process.exit(1);
});