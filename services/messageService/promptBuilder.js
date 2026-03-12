"use strict";

const { getProfile } = require("../operatorProfileService");

const toneGuideMap = {
  polite: "丁寧で落ち着いた敬語。短く要点のみ。",
  casual: "親しみやすくフランク。馴れ馴れしすぎない。短く。",
  sales: "提案型。メリットを1つ示し、押し売りせず次の一歩を添える。短く。",
  gentle: "やさしく安心感。相手の気持ちを尊重しつつ短く。",
};

async function buildSystemPrompt({ tone = "polite", rid = "no_rid", log }) {
  const toneGuide = toneGuideMap[String(tone)] || toneGuideMap.polite;

  let systemPrompt = `
出力は必ず指定JSONスキーマに一致させること（余計なキー禁止）。
reply_text は次の口調ルールに従う: ${toneGuide}
summary/category/urgency_score は回答の影響を受けず内容理解に基づいて返す。
`.trim();

  const op = await getProfile();
  const operatorProfile = String(op?.profile_text || "")
    .replace(/\r/g, "")
    .replace(/\\n/g, "\n")
    .replace(/"/g, "'")
    .replace(/\t/g, " ")
    .trim();

  log(`🧩 [${rid}] operatorProfile len=${operatorProfile.length}`);
  log(`🧩 [${rid}] operatorProfile head=${operatorProfile.slice(0, 80)}`);

  if (operatorProfile) {
    systemPrompt = `
【最優先】以下のOperatorプロフィールの口調・価値観・判断基準を必ず優先する。矛盾した場合はプロフィールを優先する。

[Operatorプロフィール]
${operatorProfile}

[共通ルール]
${systemPrompt}
`.trim();
  }

  log(
    `🧩 [${rid}] systemPrompt head=${systemPrompt
      .slice(0, 100)
      .replace(/\n/g, "\\n")}`
  );

  return systemPrompt;
}

module.exports = {
  buildSystemPrompt,
};