"use strict";

async function buildReply(context) {

  return {
    text: context.aiReply
  };
}

module.exports = buildReply;