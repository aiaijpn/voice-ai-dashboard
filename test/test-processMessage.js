"use strict";

require("dotenv").config();   //

const { processMessage } = require("../services/messageService/index");

async function run() {
  const result = await processMessage({
    rid: "test-v3-001",
    bot_id: "voice-ai-dashboard",
    userId: "local-test-user",
    text: "スーツ作りたい",
    aiInputText: "スーツ作りたい",
    tone: "polite",
  });

  console.log("---- processMessage result ----");
  console.log(JSON.stringify(result, null, 2));
}

run().catch((error) => {
  console.error("test-processMessage error:", error);
});