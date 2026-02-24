// server.js (CommonJS)
const express = require("express");
const axios = require("axios");

console.log("🚀 SERVER BOOT: server.js is running");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

if (!CHANNEL_ACCESS_TOKEN) console.warn("⚠️ CHANNEL_ACCESS_TOKEN is missing");
if (!OPENAI_API_KEY) console.warn("⚠️ OPENAI_API_KEY is missing");

function nowISO() {
  return new Date().toISOString();
}

function clampInt(n, min, max, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  const y = Math.trunc(x);
  return Math.max(min, Math.min(max, y));
}

/**
 * OpenAI Responses API + Structured Outputs (json_schema strict)
 * Returns: { reply_text, summary, category, urgency_score }
 */
async function callOpenAI_B(text) {
  const instructions = `
あなたは「LINE×AI×ダッシュボード」デモのAIです。
ユーザーの入力から、(1)返信文、(2)要約、(3)分類、(4)緊急度 を必ず生成してください。

分類 category は必ず 0〜4 の整数：
0=対象外（雑談/挨拶/無関係）
1=売上・集客
2=顧客対応
3=業務効率
4=経営判断

urgency_score は必ず 1〜9 の整数：
1〜5=低、6〜7=中、8〜9=高

注意：
- reply_text はLINE向けに、短く・丁寧・次の一歩が分かる形。
- summary は保存用、30文字前後の日本語。
- 余計なキーは出さない。スキーマに厳密準拠。
`.trim();

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      reply_text: {
        type: "string",
        description: "LINEに返信する文章（日本語、短く、丁寧、次の一歩が分かる）",
      },
      summary: {
        type: "string",
        description: "保存用の短い要約（日本語、30文字前後）",
      },
      category: {
        type: "integer",
        description: "0=対象外,1=売上集客,2=顧客対応,3=業務効率,4=経営判断",
      },
      urgency_score: {
        type: "integer",
        description: "1〜9（1-5低、6-7中、8-9高）",
      },
    },
    required: ["reply_text", "summary", "category", "urgency_score"],
  };

  // タイムアウト（遅延対策）
  const OPENAI_TIMEOUT_MS = 18_000;

  const res = await axios.post(
    "https://api.openai.com/v1/responses",
    {
      model: OPENAI_MODEL,
      instructions,
      input: text,
      // Structured Outputs: text.format json_schema strict
      text: {
        format: {
          type: "json_schema",
          name: "voice_ai_dashboard_v1",
          strict: true,
          schema,
        },
      },
      // デモなので保存はOFF推奨（コスト/データ取り回し的に）
      store: false,
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: OPENAI_TIMEOUT_MS,
    }
  );

  // Responses APIの返りから “JSONテキスト” を拾ってパースする
  const data = res.data;

  // 1) output_text があればそれを優先（SDKの helper 相当）
  // 2) 無ければ output[].content[].text を探索
  const rawText =
    (typeof data.output_text === "string" && data.output_text) ||
    (Array.isArray(data.output)
      ? data.output
          .flatMap((o) => (Array.isArray(o.content) ? o.content : []))
          .map((c) => c.text)
          .find((t) => typeof t === "string" && t.trim().length > 0)
      : null);

  if (!rawText) {
    throw new Error("OpenAI response has no text to parse");
  }

  // JSONが壊れた/余計なテキストが混ざった場合の救済
  let obj;
  try {
    obj = JSON.parse(rawText);
  } catch {
    const m = rawText.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Failed to extract JSON object from model output");
    obj = JSON.parse(m[0]);
  }

  // 最低限のガード（念のため）
  const reply_text =
    typeof obj.reply_text === "string" && obj.reply_text.trim()
      ? obj.reply_text.trim()
      : "受信しました！内容を確認します🔥";

  const summary =
    typeof obj.summary === "string" && obj.summary.trim()
      ? obj.summary.trim()
      : "要約生成に失敗";

  const category = clampInt(obj.category, 0, 4, 0);
  const urgency_score = clampInt(obj.urgency_score, 1, 9, 3);

  return { reply_text, summary, category, urgency_score };
}

async function replyToLine(replyToken, messageText) {
  const url = "https://api.line.me/v2/bot/message/reply";
  await axios.post(
    url,
    {
      replyToken,
      messages: [{ type: "text", text: messageText }],
    },
    {
      headers: {
        Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      timeout: 10_000,
    }
  );
}

// Render health check用
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

// LINE Webhook
app.post("/webhook", async (req, res) => {
  // LINEはまず 200 を早めに返すのが安全
  res.sendStatus(200);

  try {
    const events = req.body.events || [];
    for (const event of events) {
      if (event.type !== "message") continue;
      if (!event.replyToken) continue;

      const userText = event.message && event.message.text;
      if (!userText) continue;

      const t = nowISO();

      // ---- L4(B案)ここが中核 ----
      let ai;
      try {
        ai = await callOpenAI_B(userText);
      } catch (e) {
        console.error("❌ OpenAI error:", e?.message || e);
        ai = {
          reply_text:
            "今ちょっと頭をフル回転中です🙏 もう一度だけ送ってもらえますか？",
          summary: "OpenAIエラー",
          category: 0,
          urgency_score: 5,
        };
      }

      // LINE返信
      try {
        await replyToLine(event.replyToken, ai.reply_text);
      } catch (e) {
        console.error("❌ LINE reply error:", e?.message || e);
      }

      // L5へ繋ぐ：ログ（1行で）
      // timestamp | user_text | summary | category | urgency_score
      console.log(
        JSON.stringify(
          {
            timestamp: t,
            user_text: userText,
            summary: ai.summary,
            category: ai.category,
            urgency_score: ai.urgency_score,
          },
          null,
          0
        )
      );
    }
  } catch (err) {
    console.error("❌ webhook handler error:", err?.message || err);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
