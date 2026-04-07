"use strict";

/**
 * services/v35/index.js
 *
 * V3.54
 *
 * 役割:
 * - V3.5 系の会話エンジン入口
 * - 最大2回AI構成をここに閉じ込める
 *
 * 方針:
 * - 明確なら AI1回
 * - 曖昧なら 判定AI + 回答AI の最大2回
 * - messageService/index.js は薄いまま維持する
 *
 * このファイルでやること:
 * - context収集
 * - 企業判定フェーズ
 * - 回答生成フェーズ
 * - 最終replyText整形
 * - company_id の揺れ吸収
 *
 * このファイルでやらないこと:
 * - conversation_history保存
 * - handler返却整形
 */

const { collectV35Context } = require("./collectV35Context");
const { buildV35Prompt, DEFAULT_TOPIC_LABEL } = require("./buildV35Prompt");
const {
  prepareCompanyJudge,
  normalizeJudgeResult,
} = require("./companyJudgeService");

/**
 * 定数
 */
const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();

/**
 * 文字安全化
 */
function toSafeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

/**
 * company_id 正規化
 *
 * 目的:
 * - 過去ID / 揺れID を統一する
 * - シートや履歴に旧IDが一時的に残っていても、返却値を安定させる
 *
 * 正本は最終的にシート側で統一する前提。
 * ここは移行期間の保険。
 */
function normalizeCompanyId(companyId = "") {
  const value = toSafeString(companyId);

  const ID_ALIAS_MAP = {
    ikeda_legal: "ikeda_law",
    kanai_suits: "kanai_suit",
  };

  return ID_ALIAS_MAP[value] || value;
}

/**
 * ラベル整形
 */
function formatTopicLabel(topicLabel = "") {
  const label = toSafeString(topicLabel) || DEFAULT_TOPIC_LABEL;

  if (label === DEFAULT_TOPIC_LABEL) {
    return "【テーマ無し】⇒協賛企業から選択";
  }

  return `【${label}】`;
}

/**
 * 最終返信整形
 */
function buildFinalReplyText(topicLabel = "", replyMessage = "") {
  const labelText = formatTopicLabel(topicLabel);
  const body = toSafeString(replyMessage) || "確認しました。";

  return `${labelText}\n${body}`.trim();
}

/**
 * 確認質問文
 */
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
 * OpenAI responses API を叩いて JSON文字列を返す
 */
async function callOpenAIText({ systemPrompt = "", userPrompt = "" }) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required");
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const json = await response.json();

  const text =
    toSafeString(json.output_text) ||
    extractTextFromResponse(json) ||
    "";

  if (!text) {
    throw new Error("OpenAI API returned empty output_text");
  }

  return text;
}

/**
 * responses API からテキストを抽出
 */
function extractTextFromResponse(responseJson = {}) {
  const output = Array.isArray(responseJson.output) ? responseJson.output : [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];

    for (const part of content) {
      if (part?.type === "output_text" && part?.text) {
        return String(part.text).trim();
      }
    }
  }

  return "";
}

/**
 * JSON文字列パース
 */
function parseJsonSafely(text = "") {
  const raw = String(text || "").trim();

  if (!raw) {
    throw new Error("parseJsonSafely: empty text");
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    return JSON.parse(cleaned);
  }
}

/**
 * 判定AI実行
 */
async function runJudgeAI(input = {}) {
  const prepared = prepareCompanyJudge(input);

  if (!prepared?.success) {
    throw new Error(prepared?.message || "prepareCompanyJudge failed");
  }

  if (prepared.data?.mode === "skip_ai") {
    return {
      success: true,
      message: "judge skipped by code",
      data: {
        judgeMode: "skip_ai",
        judgeResult: normalizeJudgeResult(prepared.data?.judgeResult || {}),
      },
    };
  }

  const systemPrompt = toSafeString(prepared.data?.systemPrompt);
  const userPrompt = toSafeString(prepared.data?.userPrompt);

  const rawText = await callOpenAIText({
    systemPrompt,
    userPrompt,
  });

  const parsed = parseJsonSafely(rawText);
  const judgeResult = normalizeJudgeResult(parsed);

  return {
    success: true,
    message: "judge ai success",
    data: {
      judgeMode: "ai",
      judgeResult,
      rawText,
    },
  };
}

/**
 * 回答AI実行
 */
async function runAnswerAI(input = {}) {
  const built = buildV35Prompt(input);

  if (!built?.success) {
    throw new Error(built?.message || "buildV35Prompt failed");
  }

  const systemPrompt = toSafeString(built.data?.systemPrompt);
  const userPrompt = toSafeString(built.data?.userPrompt);

  const rawText = await callOpenAIText({
    systemPrompt,
    userPrompt,
  });

  const parsed = parseJsonSafely(rawText);

  return {
    success: true,
    message: "answer ai success",
    data: {
      parsed,
      rawText,
    },
  };
}

/**
 * 回答AI結果の最低限整形
 */
function normalizeAnswerResult(parsed = {}) {
  return {
    topicLabel: toSafeString(parsed.topicLabel) || DEFAULT_TOPIC_LABEL,
    replyMessage: toSafeString(parsed.replyMessage) || "確認しました。",
    matchedCompanyId: normalizeCompanyId(parsed.matchedCompanyId),
    usedWiki: Boolean(parsed.usedWiki),
    wikiAction: toSafeString(parsed.wikiAction) || "none",
    wikiDraft: parsed.wikiDraft || null,
    stockAction: toSafeString(parsed.stockAction) || "none",
    stockDraft: parsed.stockDraft || null,
    judgement: toSafeString(parsed.judgement) || "general_reply",
  };
}

/**
 * judge結果を context に反映
 */
function mergeJudgeIntoContext(context = {}, judgeResult = {}) {
  const merged = {
    ...context,
  };

  const shouldUseCompany = Boolean(judgeResult.shouldUseCompany);
  const matchedCompanyId = normalizeCompanyId(judgeResult.matchedCompanyId);

  if (shouldUseCompany && matchedCompanyId) {
    merged.currentCompanyId = matchedCompanyId;
    merged.isConversationContinuing = true;
  }

  return merged;
}

/**
 * 最終topicLabel補正
 */
function resolveFinalTopicLabel(answerResult = {}, judgeResult = {}) {
  const answerLabel = toSafeString(answerResult.topicLabel);
  const judgeLabel = toSafeString(judgeResult.topicLabel);

  if (answerLabel) {
    return answerLabel;
  }

  if (judgeLabel) {
    return judgeLabel;
  }

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
    if (!userId) {
      return {
        success: false,
        message: "runV35: userId is required",
        data: {
          rid,
          bot_id,
          userId,
        },
      };
    }

    if (!userMessage) {
      return {
        success: false,
        message: "runV35: userMessage is required",
        data: {
          rid,
          bot_id,
          userId,
        },
      };
    }

    const contextResult = await collectV35Context({
      rid,
      userMessage,
      conversationHistory: Array.isArray(input.conversationHistory)
        ? input.conversationHistory
        : [],
    });

    if (!contextResult?.success) {
      return {
        success: false,
        message: contextResult?.message || "collectV35Context failed",
        data: {
          rid,
          bot_id,
          userId,
        },
      };
    }

    const context = contextResult.data || {};

    const judgePhase = await runJudgeAI({
      userMessage,
      companyWikiCandidates: context.companyWikiCandidates || [],
      questionStockCandidates: context.questionStockCandidates || [],
      companyCandidates: context.companyCandidates || [],
      currentCompanyId: normalizeCompanyId(context.currentCompanyId || ""),
      currentCompanyName: context.currentCompanyName || "",
      isConversationContinuing: Boolean(context.isConversationContinuing),
    });

    if (!judgePhase?.success) {
      return {
        success: false,
        message: judgePhase?.message || "judge phase failed",
        data: {
          rid,
          bot_id,
          userId,
        },
      };
    }

    const judgeMode = toSafeString(judgePhase.data?.judgeMode) || "skip_ai";
    const judgeResult = normalizeJudgeResult(
      judgePhase.data?.judgeResult || {}
    );

    if (judgeResult.needsClarification) {
      const clarificationBody = buildClarificationReply(
        context.companyCandidates || []
      );

      return {
        success: true,
        message: "clarification reply",
        data: {
          replyText: buildFinalReplyText(DEFAULT_TOPIC_LABEL, clarificationBody),
          topicLabel: DEFAULT_TOPIC_LABEL,
          matchedCompanyId: "",
          usedWiki: false,
          wikiAction: "none",
          wikiDraft: null,
          stockAction: "none",
          stockDraft: null,
          judgement: "no_topic",
          judgeMode,
          judgeConfidence: judgeResult.confidence,
        },
      };
    }

    const mergedContext = mergeJudgeIntoContext(context, judgeResult);

    const answerPhase = await runAnswerAI({
      userMessage,
      companyWikiCandidates: mergedContext.companyWikiCandidates || [],
      questionStockCandidates: mergedContext.questionStockCandidates || [],
      companyCandidates: mergedContext.companyCandidates || [],
      currentCompanyId: normalizeCompanyId(mergedContext.currentCompanyId || ""),
      currentCompanyName: mergedContext.currentCompanyName || "",
      isConversationContinuing: Boolean(mergedContext.isConversationContinuing),
    });

    if (!answerPhase?.success) {
      return {
        success: false,
        message: answerPhase?.message || "answer phase failed",
        data: {
          rid,
          bot_id,
          userId,
        },
      };
    }

    const answerResult = normalizeAnswerResult(answerPhase.data?.parsed || {});
    const finalTopicLabel = resolveFinalTopicLabel(answerResult, judgeResult);
    const finalMatchedCompanyId =
      normalizeCompanyId(answerResult.matchedCompanyId) ||
      normalizeCompanyId(judgeResult.matchedCompanyId);

    const replyText = buildFinalReplyText(
      finalTopicLabel,
      answerResult.replyMessage
    );

    return {
      success: true,
      message: "runV35 success",
      data: {
        replyText,
        topicLabel: finalTopicLabel,
        matchedCompanyId: finalMatchedCompanyId,
        usedWiki: Boolean(answerResult.usedWiki),
        wikiAction: answerResult.wikiAction,
        wikiDraft: answerResult.wikiDraft,
        stockAction: answerResult.stockAction,
        stockDraft: answerResult.stockDraft,
        judgement: answerResult.judgement,
        judgeMode,
        judgeConfidence: judgeResult.confidence,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error?.message || "runV35 failed",
      data: {
        rid,
        bot_id,
        userId,
      },
    };
  }
}

module.exports = {
  runV35,
  runV54: runV35,
  parseJsonSafely,
  normalizeAnswerResult,
  buildFinalReplyText,
  formatTopicLabel,
  normalizeCompanyId,
};