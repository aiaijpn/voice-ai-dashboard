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

async function sendFlexMessage() {
  const url = "https://api.line.me/v2/bot/message/push";

  const body = {
    to: LINE_TEST_USER_ID,
    messages: [
      {
        type: "flex",
        altText: "\u9078\u629e\u5f0f\u30e1\u30c3\u30bb\u30fc\u30b8\u30c6\u30b9\u30c8",
        contents: {
          type: "bubble",
          size: "giga",
          body: {
            type: "box",
            layout: "vertical",
            spacing: "md",
            contents: [
              {
                type: "text",
                text: "\u5358\u7d14\u30c6\u30b9\u30c8",
                weight: "bold",
                size: "xl"
              },
              {
                type: "text",
                text: "\u4eca\u65e5\u306e\u6e80\u8db3\u5ea6\u306f\u3044\u304b\u304c\u3067\u3057\u305f\u304b\uff1f",
                wrap: true,
                size: "md"
              },
              {
                type: "separator",
                margin: "md"
              },
              {
                type: "text",
                text: "\u3042\u3066\u306f\u307e\u308b\u3082\u306e\u3092\u62bc\u3057\u3066\u304f\u3060\u3055\u3044",
                size: "sm",
                color: "#666666",
                wrap: true
              }
            ]
          },
          footer: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "primary",
                height: "sm",
                action: {
                  type: "message",
                  label: "\u826f\u304b\u3063\u305f",
                  text: "\u826f\u304b\u3063\u305f"
                }
              },
              {
                type: "button",
                style: "primary",
                height: "sm",
                action: {
                  type: "message",
                  label: "\u666e\u901a",
                  text: "\u666e\u901a"
                }
              },
              {
                type: "button",
                style: "primary",
                height: "sm",
                action: {
                  type: "message",
                  label: "\u76f8\u8ac7\u3057\u305f\u3044",
                  text: "\u76f8\u8ac7\u3057\u305f\u3044"
                }
              },
              {
                type: "button",
                style: "secondary",
                height: "sm",
                action: {
                  type: "message",
                  label: "\u307e\u305f\u884c\u304d\u305f\u3044",
                  text: "\u307e\u305f\u884c\u304d\u305f\u3044"
                }
              },
              {
                type: "button",
                style: "secondary",
                height: "sm",
                action: {
                  type: "message",
                  label: "\u8a73\u3057\u304f\u77e5\u308a\u305f\u3044",
                  text: "\u8a73\u3057\u304f\u77e5\u308a\u305f\u3044"
                }
              },
              {
                type: "button",
                style: "secondary",
                height: "sm",
                action: {
                  type: "message",
                  label: "\u4e88\u7d04\u3057\u305f\u3044",
                  text: "\u4e88\u7d04\u3057\u305f\u3044"
                }
              },
              {
                type: "button",
                style: "link",
                height: "sm",
                action: {
                  type: "message",
                  label: "\u554f\u3044\u5408\u308f\u305b",
                  text: "\u554f\u3044\u5408\u308f\u305b"
                }
              }
            ],
            flex: 0
          }
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

    console.log("OK: Flex pushëóêMê¨å˜");
    console.log("status:", response.status);
  } catch (error) {
    console.error("NG: Flex pushëóêMé∏îs");

    if (error.response) {
      console.error("status:", error.response.status);
      console.error("data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("message:", error.message);
    }

    process.exit(1);
  }
}

sendFlexMessage();