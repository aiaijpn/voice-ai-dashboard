"use strict";

require("dotenv").config();

const {
  getCompaniesForList,
  findCompaniesForAi,
} = require("../services/companyService");

async function main() {
  console.log("=== getCompaniesForList ===");
  const list = await getCompaniesForList();
  console.log(JSON.stringify(list, null, 2));

  console.log("\n=== findCompaniesForAi('スーツ') ===");
  const aiCandidates = await findCompaniesForAi("スーツ");
  console.log(JSON.stringify(aiCandidates, null, 2));
}

main().catch((error) => {
  console.error("check-company-service error:", error);
  process.exit(1);
});