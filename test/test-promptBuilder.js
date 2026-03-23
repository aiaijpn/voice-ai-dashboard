"use strict";

const {
  buildPromptContext,
  buildCompanyHint,
} = require("../services/messageService/promptBuilder");

async function run() {
  const companyCandidates = [
    {
      display_name: "オーダースーツの金井",
      category: "スーツ",
      short_pitch: "装いへの気配り、いかがですか。",
    },
  ];

  console.log("---- companyCandidates input ----");
  console.log(JSON.stringify(companyCandidates, null, 2));

  console.log("---- buildCompanyHint ----");
  const companyHint = buildCompanyHint(companyCandidates);
  console.log(companyHint);

  const result = await buildPromptContext({
    rid: "test123",
    tone: "polite",
    historyItems: [],
    userText: "スーツ作りたい",
    companyCandidates,
    log: console.log,
  });

  console.log("---- systemPrompt ----");
  console.log(result.systemPrompt);

  console.log("---- messages ----");
  console.log(JSON.stringify(result.messages, null, 2));
}

run().catch((error) => {
  console.error("test-promptBuilder error:", error);
});