"use strict";

require("dotenv").config();
const axios = require("axios");

const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;
const LINE_TEST_USER_ID = process.env.LINE_TEST_USER_ID;

if (!CHANNEL_ACCESS_TOKEN) {
  console.error("NG: CHANNEL_ACCESS_TOKEN Ç™ .env Ç…Ç†ÇËÇ‹ÇπÇÒ");
  process.exit(1);
}

if (!LINE_TEST_USER_ID) {
  console.error("NG: LINE_TEST_USER_ID Ç™ .env Ç…Ç†ÇËÇ‹ÇπÇÒ");
  process.exit(1);
}

async function sendTestMessage() {
  const url = "https://api.line.me/v2/bot/message/push";

  const body = {
    to: LINE_TEST_USER_ID,
    messages: [
      {
        type: "text",
        text: "\u9078\u629e\u80a2\u30de\u30c3\u30af\u30b9\u30c6\u30b9\u30c8\u3067\u3059\u3002\u6c17\u306b\u306a\u308b\u3082\u306e\u3092\u62bc\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
        quickReply: {
          items: [
            {
              type: "action",
              action: {
                type: "message",
                label: "\u2460 \u826f\u304b\u3063\u305f",
                text: "\u826f\u304b\u3063\u305f"
              }
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "\u2461 \u666e\u901a",
                text: "\u666e\u901a"
              }
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "\u2462 \u76f8\u8ac7\u3057\u305f\u3044",
                text: "\u76f8\u8ac7\u3057\u305f\u3044"
              }
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "\u2463 \u307e\u305f\u884c\u304d\u305f\u3044",
                text: "\u307e\u305f\u884c\u304d\u305f\u3044"
              }
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "\u2464 \u8208\u5473\u3042\u308a",
                text: "\u8208\u5473\u3042\u308a"
              }
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "\u2465 \u8a73\u3057\u304f\u77e5\u308a\u305f\u3044",
                text: "\u8a73\u3057\u304f\u77e5\u308a\u305f\u3044"
              }
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "\u2466 \u53c2\u52a0\u3057\u305f\u3044",
                text: "\u53c2\u52a0\u3057\u305f\u3044"
              }
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "\u2467 \u4fdd\u7559",
                text: "\u4fdd\u7559"
              }
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "\u2468 \u4e0d\u8981",
                text: "\u4e0d\u8981"
              }
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "\u2469 \u4eca\u65e5\u306f\u898b\u9001\u308b",
                text: "\u4eca\u65e5\u306f\u898b\u9001\u308b"
              }
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "\u246a \u5f8c\u3067\u898b\u308b",
                text: "\u5f8c\u3067\u898b\u308b"
              }
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "\u246b \u4e88\u7d04\u3057\u305f\u3044",
                text: "\u4e88\u7d04\u3057\u305f\u3044"
              }
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "\u246c \u554f\u3044\u5408\u308f\u305b",
                text: "\u554f\u3044\u5408\u308f\u305b"
              }
            }
          ]
        }
      }
    ]
  };

  try {
    const response = await axios.post(url, body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`
      }
    });

    console.log("OK: pushëóêMê¨å˜");
    console.log("status:", response.status);
  } catch (error) {
    console.error("NG: pushëóêMé∏îs");

    if (error.response) {
      console.error("status:", error.response.status);
      console.error("data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("message:", error.message);
    }

    process.exit(1);
  }
}

sendTestMessage();