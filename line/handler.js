// 繝輔ぃ繧､繝ｫ: voice-ai-dashboard/line/handler.js
"use strict";

const { log } = require("../utils/logger");縲//log繝ｩ繝・ヱ繝ｼ 2026/3/1

const axios = require("axios");
const { processMessage } = require("../services/messageService");

log("逃 handler.js loaded:", new Date().toISOString());

const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;

log("肌 ENV CHECK (handler)");
log(" - CHANNEL_ACCESS_TOKEN:", CHANNEL_ACCESS_TOKEN ? "OK" : "MISSING");

// historyStore 縺ｯ STEP2 縺ｧ譁ｰ隕丈ｽ懈・縺吶ｋ諠ｳ螳壹・
// 蜈医↓ handler.js 繧堤峩縺励※繧り誠縺｡縺ｪ縺・ｈ縺・↓縲悟ｭ伜惠縺吶ｌ縺ｰ菴ｿ縺・肴婿蠑上↓縺励※縺ゅｋ縲・
let historyStore = null;
try {
  historyStore = require("./historyStore");
  log("ｧ historyStore: OK (./historyStore)");
} catch (e) {
  log("ｧ historyStore: NOT FOUND (STEP2縺ｧ霑ｽ蜉莠亥ｮ・ -> history disabled for now");
}

const HISTORY_MAX = Number(process.env.HISTORY_MAX || 10); // 逶ｴ霑鮮莉ｶ・・ole蜊倅ｽ搾ｼ・

/**
 * 螻･豁ｴ繧但I縺ｫ豺ｷ縺懊ｋ縺溘ａ縺ｮ霆ｽ驥上ヵ繧ｩ繝ｼ繝槭ャ繝・
 * 窶ｻ processMessage 蛛ｴ繧定ｧｦ繧峨↑縺上※繧ゅ》ext縺ｫ豺ｷ縺懊ｌ縺ｰ莨夊ｩｱ縺檎ｹ九′繧・
 */
function buildTextWithHistory(userText, history = []) {
  if (!history || history.length === 0) return userText;

  const lines = history
    .slice(-HISTORY_MAX)
    .map((m) => {
      const role = m.role === "assistant" ? "AI" : "User";
      const content = String(m.content || "").replace(/\s+/g, " ").trim();
      return `${role}: ${content}`;
    })
    .join("\n");

  return `縲千峩霑代・莨夊ｩｱ縲曾n${lines}\n\n縲蝉ｻ雁屓縲曾nUser: ${userText}`;
}

const handleEvent = async (event, ctx = {}) => {
  const rid = Math.random().toString(16).slice(2, 8);

  try {
    log("========================================");
    log(`筐｡・・[${rid}] handleEvent start`);
    log(`   type=${event.type}`);
    log(`   messageType=${event.message?.type}`);

    if (event.type !== "message" || event.message.type !== "text") {
      log(`笞・・[${rid}] Not a text message. Skip.`);
      return;
    }

    const userText = event.message.text;
    log(`統 [${rid}] userText=`, userText);

    // ===== 譌｢隱ｭ繝医・繧ｯ繝ｳ・・025/11縲・Messaging API・・====
    const markAsReadToken = event.message?.markAsReadToken;
    log(`早・・[${rid}] markAsReadToken=`, markAsReadToken ? "FOUND" : "NONE");

    const tone = String(ctx.tone || "polite");
    const bot_id = process.env.BOT_ID || "voice-ai-dashboard";
    const userId = event.source?.userId || "";
    const historyKey = `${bot_id}:${userId || "no_userId"}`;

    // ===== 螻･豁ｴ繝ｭ繝ｼ繝会ｼ医≠繧後・・・====
    let history = [];
    if (historyStore?.getHistory) {
      try {
        history = await historyStore.getHistory(historyKey);
        log(`ｧ [${rid}] history loaded: key=${historyKey} len=${history.length}`);
      } catch (e) {
        log(`ｧ [${rid}] history load failed:`, e.message || e);
      }
    } else {
      log(`ｧ [${rid}] historyStore disabled -> skip load`);
    }

    // ===== 莉雁屓繝ｦ繝ｼ繧ｶ繝ｼ逋ｺ險繧貞ｱ･豁ｴ縺ｫ菫晏ｭ假ｼ医≠繧後・・・====
    if (historyStore?.appendMessage) {
      try {
        await historyStore.appendMessage(historyKey, { role: "user", content: userText });
        log(`ｧ [${rid}] history appended (user)`);
        // append蠕後∵怙譁ｰ繧貞・蜿門ｾ暦ｼ・莉ｶ蛻ｶ髯舌・store蛛ｴ縺ｧ繧０K縺縺悟ｿｵ縺ｮ縺溘ａ・・
        history = await historyStore.getHistory(historyKey);
      } catch (e) {
        log(`ｧ [${rid}] history append(user) failed:`, e.message || e);
      }
    }

    // ===== 螻･豁ｴ繧偵ユ繧ｭ繧ｹ繝医↓豺ｷ縺懊ｋ・・tore辟｡縺励〒繧０K・・====
    const textForAI = buildTextWithHistory(userText, history);
    if (history.length > 0) {
      log(`ｧｾ [${rid}] textForAI includes history (len=${history.length})`);
    }

    // ===== service縺ｸ蟋碑ｭｲ =====
    const svc = await processMessage({
      rid,
      bot_id,
      userId,
      text: textForAI,
      tone,
      timestamp: Date.now(),
      rawEvent: event,
      // 繧ゅ＠ processMessage 蛛ｴ縺・history 繧呈桶縺医ｋ繧医≧縺ｫ縺ｪ縺｣縺溘ｉ縲√◎縺ｮ縺ｾ縺ｾ菴ｿ縺医ｋ
      history: history.slice(-HISTORY_MAX),
    });

    const replyText = svc?.replyText || "蜿嶺ｿ｡縺励∪縺励◆";
    log(`ｧｩ [${rid}] service replyText=`, replyText);

    // ===== AI霑皮ｭ斐ｒ螻･豁ｴ縺ｫ菫晏ｭ假ｼ医≠繧後・・・====
    if (historyStore?.appendMessage) {
      try {
        await historyStore.appendMessage(historyKey, { role: "assistant", content: replyText });
        log(`ｧ [${rid}] history appended (assistant)`);
      } catch (e) {
        log(`ｧ [${rid}] history append(assistant) failed:`, e.message || e);
      }
    }

    // ===== LINE霑比ｿ｡ =====
    log(`豆 [${rid}] Sending reply to LINE...`);

    await axios.post(
      "https://api.line.me/v2/bot/message/reply",
      {
        replyToken: event.replyToken,
        messages: [{ type: "text", text: replyText }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        },
        timeout: 15000,
      }
    );

    log(`脂 [${rid}] LINE reply success`);

    // ===== 譌｢隱ｭ莉倅ｸ趣ｼ・025/11縲・Messaging API・・====
    // token 縺檎┌縺・ｴ蜷医・繧ｹ繧ｭ繝・・縲ょ､ｱ謨励＠縺ｦ繧りｿ比ｿ｡縺ｯ豁｢繧√↑縺・ｼ域ｸｩ蠎ｦ邯ｭ謖∝━蜈茨ｼ・
    if (markAsReadToken) {
      try {
        log(`早・・[${rid}] Marking as read...`);
        await axios.post(
          "https://api.line.me/v2/bot/chat/markAsRead",
          { markAsReadToken },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
            },
            timeout: 15000,
          }
        );
        log(`笨・[${rid}] markAsRead success`);
      } catch (e) {
        log(`笞・・[${rid}] markAsRead failed:`, e.response?.data || e.message || e);
      }
    } else {
      log(`早・・[${rid}] markAsRead skipped (no token)`);
    }

    log(`筮・ｸ・[${rid}] handleEvent done`);
  } catch (error) {
    console.error("徴 Handler error:", error.response?.data || error.message || error);
  }
};

module.exports = { handleEvent };




