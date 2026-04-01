"use strict";

require("dotenv").config();

const { getAllCompaniesFromSheet } = require("../services/companySheetService");

async function main() {
  const companies = await getAllCompaniesFromSheet();
  console.log(JSON.stringify(companies, null, 2));
}

main().catch(err => {
  console.error("check-company-master error:", err);
  process.exit(1);
});