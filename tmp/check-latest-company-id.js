"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");

// ★ここ追加
const serviceAccountPath = path.resolve(
  __dirname,
  "../../voice-ai-dashboard-488404-8bf826020d17.json"
);

const serviceAccount = fs.readFileSync(serviceAccountPath, "utf-8");
process.env.GOOGLE_SERVICE_ACCOUNT_JSON = serviceAccount;

const {
  getLatestCompanyIdFromHistory,
} = require("../services/historyService");

async function main() {
  const result = await getLatestCompanyIdFromHistory({
    botId: "voice-ai-dashboard",
    /* userId: "ここを実際のuserIdに置換", */
    userId: "test_user_kanai",
    limit: 10,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});