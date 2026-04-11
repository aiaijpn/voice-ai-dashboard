"use strict";

const { collectV35Context } = require("./collectV35Context");
const { buildV35Prompt, DEFAULT_TOPIC_LABEL } = require("./buildV35Prompt");
const {
  prepareCompanyJudge,
  normalizeJudgeResult,
} = require("./companyJudgeService");

const { callV35Ai } = require("./callV35Ai");

// ✅ 追加（これが最重要）
const { parseV35Response } = require("./parseV35Response");

function toSafeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeCompanyId(companyId = "") {
  const value = toSafeString(companyId);
  const ID_ALIAS_MAP = {
    ikeda_legal: "ikeda_law",
    kanai_suits: "kanai_suit",
  };
  return ID_ALIAS_MAP[value] || value;
}

function formatTopicLabel(topicLabel = "") {
  const label = toSafeString(topicLabel) || DEFAULT_TOPIC_LABEL;

  if (label === DEFAULT_TOPIC_LABEL) {
    return "【テーマ無し】⇒協賛企業から選択";
  }

  return `【${label}】`;
}

function buildFinalReplyText(topicLabel = "", replyMessage = "") {
  const labelText = formatTopicLabel(topicLabel);
  const body = toSafeString(replyMessage) || "確認しました。";
  return `${labelText}\n${body}`.trim();
}

function buildClarificationReply(companyCandidates = []) {
  const names = Array.isArray(companyCandidates)
    ? companyCandidates
        .map((item) => toSafeString(item.topic_label || item.company_name))
        .filter(Boolean)
        .slice(0, 3)
    : [];

  if (names.length === 0) {
    return "どの内容について知りたいですか？";
  }

  return `どの内容について知りたいですか？\n・${names.join("\n・")}`;
}

/**
 * 判定AI
 */
async function runJudgeAI(input = {}) {
  const prepared = prepareCompanyJudge(input);

  if (!prepared?.success) {
    throw new Error(prepared?.message || "prepareCompanyJudge failed");
  }

  if (prepared.data?.mode === "skip_ai") {
    return {
      success: true,
      data: {
        judgeMode: "skip_ai",
        judgeResult: normalizeJudgeResult(prepared.data?.judgeResult || {}),
      },
    };
  }

  const aiResult = await callV35Ai({
    rid: input.rid,
    systemPrompt: prepared.data.systemPrompt,
    userPrompt: prepared.data.userPrompt,
  });

  if (!aiResult.success) {
    throw new Error(aiResult.message);
  }

  // ✅ 修正ポイント①
  const parsedResult = parseV35Response({
    rid: input.rid,
    aiRawText: aiResult.data.aiRawText,
    context: input,
  });

  if (!parsedResult.success) {
    throw new Error(parsedResult.message);
  }

  const parsed = parsedResult.data.parsed;

  return {
    success: true,
    data: {
      judgeMode: "ai",
      judgeResult: normalizeJudgeResult(parsed),
    },
  };
}

/**
 * 回答AI
 */
async function runAnswerAI(input = {}) {
  const built = buildV35Prompt(input);

  if (!built?.success) {
    throw new Error(built?.message || "buildV35Prompt failed");
  }

  const aiResult = await callV35Ai({
    rid: input.rid,
    systemPrompt: built.data.systemPrompt,
    userPrompt: built.data.userPrompt,
  });

  if (!aiResult.success) {
    throw new Error(aiResult.message);
  }

  // ✅ 修正ポイント②
  const parsedResult = parseV35Response({
    rid: input.rid,
    aiRawText: aiResult.data.aiRawText,
    context: input,
  });

  if (!parsedResult.success) {
    throw new Error(parsedResult.message);
  }

  const parsed = parsedResult.data.parsed;

  return {
    success: true,
    data: {
      parsed,
    },
  };
}

function normalizeAnswerResult(parsed = {}) {
  const companyId = normalizeCompanyId(
    parsed.companyId || parsed.matchedCompanyId
  );

  return {
    topicLabel: toSafeString(parsed.topicLabel) || DEFAULT_TOPIC_LABEL,
    replyMessage: toSafeString(parsed.replyMessage) || "確認しました。",
    companyId,
    matchedCompanyId: companyId,
    usedWiki: Boolean(parsed.usedWiki),
    wikiAction: toSafeString(parsed.wikiAction) || "none",
    wikiDraft: parsed.wikiDraft || null,
    stockAction: toSafeString(parsed.stockAction) || "none",
    stockDraft: parsed.stockDraft || null,
    judgement: toSafeString(parsed.judgement) || "general_reply",
  };
}

function mergeJudgeIntoContext(context = {}, judgeResult = {}) {
  const merged = { ...context };

  const shouldUseCompany = Boolean(judgeResult.shouldUseCompany);
  const companyId = normalizeCompanyId(
    judgeResult.companyId || judgeResult.matchedCompanyId
  );

  if (shouldUseCompany && companyId) {
    merged.currentCompanyId = companyId;
    merged.isConversationContinuing = true;
  }

  return merged;
}

function resolveFinalTopicLabel(answerResult = {}, judgeResult = {}) {
  const answerLabel = toSafeString(answerResult.topicLabel);
  const judgeLabel = toSafeString(judgeResult.topicLabel);

  if (answerLabel) return answerLabel;
  if (judgeLabel) return judgeLabel;

  return DEFAULT_TOPIC_LABEL;
}

/**
 * メイン
 */
async function runV35(input = {}) {
  const rid = toSafeString(input.rid) || "no_rid";
  const bot_id = toSafeString(input.bot_id) || "voice-ai-dashboard";
  const userId = toSafeString(input.userId);
  const userMessage = toSafeString(input.userMessage);

  try {
    const contextResult = await collectV35Context({
      rid,
      userMessage,
      conversationHistory: input.conversationHistory || [],
    });

    if (!contextResult.success) throw new Error(contextResult.message);

    const context = contextResult.data;

    const judgePhase = await runJudgeAI({
      rid,
      userMessage,
      ...context,
    });

    if (!judgePhase.success) throw new Error("judge failed");

    const judgeResult = judgePhase.data.judgeResult;

    if (judgeResult.needsClarification) {
      return {
        success: true,
        data: {
          replyText: buildFinalReplyText(
            DEFAULT_TOPIC_LABEL,
            buildClarificationReply(context.companyCandidates)
          ),
        },
      };
    }

    const mergedContext = mergeJudgeIntoContext(context, judgeResult);

    const answerPhase = await runAnswerAI({
      rid,
      userMessage,
      ...mergedContext,
    });

    if (!answerPhase.success) throw new Error("answer failed");

    const answerResult = normalizeAnswerResult(answerPhase.data.parsed);

    const finalTopicLabel = resolveFinalTopicLabel(
      answerResult,
      judgeResult
    );

    const replyText = buildFinalReplyText(
      finalTopicLabel,
      answerResult.replyMessage
    );

    return {
     success: true,
      data: {
        replyText,
         topicLabel: finalTopicLabel,
          companyId: answerResult.companyId,
         matchedCompanyId: answerResult.companyId,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
      data: { rid },
    };
  }
}

module.exports = {
  runV35,
};