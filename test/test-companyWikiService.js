"use strict";

require("dotenv").config();

const {
  findCompanyWikiAnswer,
} = require("../services/companyWikiService");

(async () => {
  console.log("START TEST");

  try {
    const result = await findCompanyWikiAnswer({
      companyId: "kanai_suit",
      userQuestion: "予約は必要ですか",
    });

    console.log("RESULT:");
    console.dir(result, { depth: null });
  } catch (error) {
    console.error("ERROR:");
    console.error(error.message);
  }

  console.log("END TEST");
})();