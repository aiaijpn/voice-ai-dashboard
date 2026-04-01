"use strict";

require("dotenv").config();

const { collectV35Context } = require("../services/v35/collectV35Context");
const { buildV35Prompt } = require("../services/v35/buildV35Prompt");

async function main() {
  const userMessage = process.argv.slice(2).join(" ").trim();

  if (!userMessage) {
    console.error("使い方: node tmp/check-v35-context.js スーツを作りたい");
    process.exit(1);
  }

  console.log("========================================");
  console.log("userMessage:");
  console.log(userMessage);
  console.log("========================================");

  const contextResult = await collectV35Context({
    rid: "tmp_check_v35",
    userMessage,
  });

  console.log("\n[collectV35Context]");
  console.log(JSON.stringify(contextResult, null, 2));

  if (!contextResult.success) {
    console.error("\ncollectV35Context failed.");
    process.exit(1);
  }

  const promptResult = buildV35Prompt({
    userMessage,
    companyWikiCandidates: contextResult.data.companyWikiCandidates,
    questionStockCandidates: contextResult.data.questionStockCandidates,
    companyCandidates: contextResult.data.companyCandidates,
  });

  console.log("\n[buildV35Prompt]");
  console.log(JSON.stringify(promptResult, null, 2));

  if (!promptResult.success) {
    console.error("\nbuildV35Prompt failed.");
    process.exit(1);
  }

  console.log("\n[systemPrompt]");
  console.log(promptResult.data.systemPrompt);

  console.log("\n[userPrompt]");
  console.log(promptResult.data.userPrompt);
}

main().catch((error) => {
  console.error("check-v35-context error:", error);
  process.exit(1);
});