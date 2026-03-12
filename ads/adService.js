"use strict";

const axios = require("axios");
const ads = require("./ads");
const { error: logError } = require("../utils/logger");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function pickAdByWeight() {
  const totalWeight = ads.reduce((sum, ad) => sum + (ad.weight || 0), 0);

  if (totalWeight <= 0) return null;

  const rand = Math.random() * totalWeight;
  let cumulative = 0;

  for (const ad of ads) {
    cumulative += ad.weight || 0;
    if (rand < cumulative) {
      return ad;
    }
  }

  return ads[0] || null;
}

async function decorateAdWithAI(adTitle) {
  if (!OPENAI_API_KEY) {
    return `こんな場もあります\n${adTitle}`;
  }

  const systemPrompt = `
AI会話の末尾に添える短い案内文を作ってください。

条件
・1行
・やや豊かだが控えめ
・広告名を含める
・押し売りしない
・誇大表現しない
・自然な紹介感
・広告文のみ出力

表現イメージ
・こんな場もあります
・こういう集まりもあります
・こんなお店もあります
・もし興味があれば
`.trim();

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `広告名: ${adTitle}` }
        ],
        temperature: 0.8,
        max_tokens: 80
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const text = response?.data?.choices?.[0]?.message?.content?.trim();

    if (!text) {
      return `こんな場もあります\n${adTitle}`;
    }

    return text;
  } catch (err) {
    logError("ad decoration error", err.response?.data || err.message);
    return `こんな場もあります\n${adTitle}`;
  }
}

async function insertAd(aiReply) {
  if (!aiReply) return aiReply;

  const ad = pickAdByWeight();
  if (!ad) return aiReply;

  const adBlock = await decorateAdWithAI(ad.title);

  return `${aiReply}

${adBlock}`;
}

module.exports = {
  insertAd
};