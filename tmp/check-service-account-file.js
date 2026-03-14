"use strict";

/**
 * GOOGLE_SERVICE_ACCOUNT_FILE の単独診断
 *
 * 確認すること:
 * 1. 環境変数があるか
 * 2. 指定ファイルが存在するか
 * 3. JSONとして読めるか
 * 4. service account として最低限のキーがあるか
 *
 * 注意:
 * このテストは「ファイルが正しいか」を見るだけ。
 * 現在の sheet/saver.js 本体は GOOGLE_SERVICE_ACCOUNT_JSON 方式なので、
 * このテストが通っても、そのまま本体保存が動くわけではない。
 */


const fs = require("fs");
const path = require("path");

require("dotenv").config();

function main() {
  console.log("=================================");
  console.log("Service Account File Check");
  console.log("=================================");

  const rawPath = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

  if (!rawPath) {
    console.log({
      success: false,
      message:
        "GOOGLE_SERVICE_ACCOUNT_FILE is required",
      data: null,
    });
    process.exit(1);
  }

  // 実行位置基準で絶対パス化
  const resolvedPath = path.resolve(process.cwd(), rawPath);

  console.log("rawPath     :", rawPath);
  console.log("resolvedPath:", resolvedPath);

  if (!fs.existsSync(resolvedPath)) {
    console.log({
      success: false,
      message: "service account file was not found",
      data: {
        rawPath,
        resolvedPath,
      },
    });
    process.exit(1);
  }

  let parsed;
  try {
    const text = fs.readFileSync(resolvedPath, "utf8");
    parsed = JSON.parse(text);
  } catch (error) {
    console.log({
      success: false,
      message: `invalid JSON file: ${error.message}`,
      data: {
        rawPath,
        resolvedPath,
      },
    });
    process.exit(1);
  }

  const requiredKeys = [
    "type",
    "project_id",
    "private_key",
    "client_email",
  ];

  const missingKeys = requiredKeys.filter((key) => !parsed[key]);

  if (missingKeys.length > 0) {
    console.log({
      success: false,
      message: "service account JSON is missing required keys",
      data: {
        rawPath,
        resolvedPath,
        missingKeys,
      },
    });
    process.exit(1);
  }

  if (parsed.type !== "service_account") {
    console.log({
      success: false,
      message: `unexpected type: ${parsed.type}`,
      data: {
        rawPath,
        resolvedPath,
      },
    });
    process.exit(1);
  }

  console.log({
    success: true,
    message: "service account file looks valid",
    data: {
      rawPath,
      resolvedPath,
      project_id: parsed.project_id,
      client_email: parsed.client_email,
      type: parsed.type,
    },
  });
}

main();