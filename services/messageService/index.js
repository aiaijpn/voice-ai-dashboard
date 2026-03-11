"use strict";

const classifyMessage = require("./classifyMessage");
const handleConversation = require("./handleConversation");
const buildReply = require("./buildReply");

async function processMessage(context) {

  const classified = await classifyMessage(context);

  const conversation = await handleConversation(classified);

  const reply = await buildReply(conversation);

  return {
    success: true,
    message: "processed",
    data: reply
  };
}

module.exports = {
  processMessage
};