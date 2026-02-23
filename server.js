const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

// 動作確認用
app.get("/", (req, res) => {
  res.status(200).send("Voice AI Dashboard Alive 🚀");
});

app.post("/webhook", async (req, res) => {
  console.log("Webhook received:", JSON.stringify(req.body, null, 2));

  const events = req.body.events;

  if (!events || events.length === 0) {
    return res.status(200).end();
  }

  const event = events[0];

  // テキストメッセージのみ対応
  if (event.type === "message" && event.message.type === "text") {
    try {
      await axios.post(
        "https://api.line.me/v2/bot/message/reply",
        {
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: "受信しました 🔥"
            }
          ]
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.CHANNEL_ACCESS_TOKEN}`
          }
        }
      );
    } catch (error) {
      console.error(
        "Reply error:",
        error.response ? error.response.data : error.message
      );
    }
  }

  res.status(200).end();
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
