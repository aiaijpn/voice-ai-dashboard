"use strict";

require("dotenv").config();

const {
  saveQuestionStock,
  getAllQuestionStockRows,
  findExistingStockRow,
} = require("../services/questionStockService");

const { google } = require("googleapis");

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

function line(title = "") {
  console.log("\n=================================");
  console.log(title);
  console.log("=================================");
}

async function main() {
  const normalized_question = process.argv[2] || "v3.3テスト質問";
  const company_id = process.argv[3] || "";
  const repeatCount = Number(process.argv[4] || 2);

  if (!Number.isInteger(repeatCount) || repeatCount < 1) {
    throw new Error("repeatCount must be an integer >= 1");
  }

  line("V3.3 question_stock test");

  console.log("normalized_question =", normalized_question);
  console.log("company_id          =", company_id || "(empty)");
  console.log("repeatCount         =", repeatCount);

  const sheets = createSheetsClient();

  line("Before");
  const beforeRows = await getAllQuestionStockRows(sheets);
  const beforeMatch = findExistingStockRow(
    beforeRows,
    company_id,
    normalized_question
  );

  console.log("beforeMatch =", beforeMatch
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

  line("Run saveQuestionStock()");
  for (let i = 1; i <= repeatCount; i += 1) {
    const result = await saveQuestionStock({
      user_id: "test-user",
      bot_id: "voice-ai-dashboard",
      question: normalized_question,
      normalized_question,
      company_id,
      user_question: normalized_question,
      wiki_answer: "",
      review_note: "",
      question_category: "test",
      group_key: "",
      canonical_question: "",
      draft_answer: "",
      draft_answer_source: "local_test",
      adopted_at: "",
    });

    console.log(`run[${i}] =`, result);
  }

  line("After");
  const afterRows = await getAllQuestionStockRows(sheets);
  const afterMatch = findExistingStockRow(
    afterRows,
    company_id,
    normalized_question
  );

  console.log("afterMatch =", afterMatch
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
    return;
  }

  const beforeCount = beforeMatch ? Number(beforeMatch.asked_count || 0) : 0;
  const afterCount = Number(afterMatch.asked_count || 0);
  const diff = afterCount - beforeCount;

  console.log("beforeCount =", beforeCount);
  console.log("afterCount  =", afterCount);
  console.log("diff        =", diff);

  if (diff === repeatCount) {
    console.log("OK: V3.3 update / append は期待どおり動作しています");
  } else {
    console.log("NG: asked_count の増分が期待と一致しません");
  }
}

main().catch((error) => {
  console.error("unexpected error:", error);
  process.exit(1);
});