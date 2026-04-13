"use strict";

/**
 * ============================================================
 * V35 CORE ENGINE - SINGLE SOURCE OF TRUTH
 * ============================================================
 *
 * 【役割】
 * このファイルは「会話の最終意思決定」を担う唯一の中核である。
 *
 * 決定対象:
 * - companyId（最終確定）
 * - topicLabel（表示テーマ）
 * - replyText（ユーザー返答）
 *
 * 上記3つはこのファイルの出力のみを正本とする。
 *
 * ============================================================
 * 【絶対ルール（破ると齟齬が発生する）】
 *
 * 1. 外部で意思決定をしない
 *    - messageService は絶対に companyId / topicLabel を決めない
 *    - 他ファイルで補正・上書きしない
 *
 * 2. このファイルが唯一の決定者
 *    - resolveFinalCompanyId()
 *    - resolveFinalTopicLabel()
 *    - buildFinalReplyText()
 *    → この3箇所が最終決定ロジック
 *
 * 3. 判定ロジックの重複禁止
 *    - classifyMessage 等で company 判定をしない
 *    - 判定は必ず runJudgeAI → normalizeJudgeResult に集約
 *
 * 4. データの正本は常にここ
 *    - companyId は normalizeCompanyId 済みを使う
 *    - matchedCompanyId / currentCompanyId の再解釈禁止
 *
 * 5. 文脈補完は最小限
 *    - currentCompanyId は「最後の保険」
 *    - fresh candidate がある場合は絶対に使わない
 *
 * 6. 表示と内部IDを混同しない
 *    - topicLabel は表示専用
 *    - companyId は内部ID
 *    - 相互変換は findTopicLabelByCompanyId のみ使用
 *
 * ============================================================
 * 【設計禁止事項】
 *
 * - messageService 側で companyId を再決定する
 * - buildReply 側で topicLabel を付け替える
 * - 他サービスで conversationContinuing を上書きする
 * - 複数箇所で company 判定ロジックを書く
 *
 * ============================================================
 * 【設計意図】
 *
 * 「意思決定を一箇所に固定することで齟齬を防ぐ」
 *
 * このファイルを壊す変更は、
 * “全会話ロジックに影響する変更” として扱うこと。
 *
 * ============================================================
 */


const { collectV35Context } = require("./collectV35Context");
const { buildV35Prompt, DEFAULT_TOPIC_LABEL } = require("./buildV35Prompt");
const {
  prepareCompanyJudge,
  normalizeJudgeResult,
} = require("./companyJudgeService");

const { callV35Ai } = require("./callV35Ai");
const { parseV35Response } = require("./parseV35Response");

function toSafeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCompanyId(companyId = "") {
  const value = toSafeString(companyId);
  const ID_ALIAS_MAP = {
    ikeda_legal: "ikeda_law",
    kanai_suits: "kanai_suit",
  };
  return ID_ALIAS_MAP[value] || value;
}

function getDefaultTopicLabelByCompanyId(companyId = "") {
  const id = normalizeCompanyId(companyId);

  const TOPIC_LABEL_BY_ID = {
    kanai_suit: "オーダースーツ金井",
    ogata_souzoku: "相続の尾形",
    ikeda_law: "池田法律相談",
    takamura_ai: "AIサービス高村",
    nishikawa_beauty: "美容西川",
  };

  return TOPIC_LABEL_BY_ID[id] || "";
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

function looksLikeInternalId(value = "") {
  const text = toSafeString(value);
  if (!text) return false;

  return /^[a-z0-9_]+$/i.test(text) && text.includes("_");
}

function findTopicLabelByCompanyId(companyId = "", companyCandidates = []) {
  const normalizedId = normalizeCompanyId(companyId);
  const items = toSafeArray(companyCandidates);

  for (const item of items) {
    const itemId = normalizeCompanyId(item.company_id);
    if (itemId !== normalizedId) continue;

    const label =
      toSafeString(item.topic_label) ||
      toSafeString(item.company_name);

    if (label && !looksLikeInternalId(label)) {
      return label;
    }
  }

  return getDefaultTopicLabelByCompanyId(normalizedId);
}

/**
 * 継続候補を補う
 * ただし currentCompanyId は「最後の保険」なので、
 * byConversationContext フラグ付きで末尾寄りの弱い候補として扱う
 */
function ensureContinuingCompanyCandidate(context = {}) {
  const companyCandidates = toSafeArray(context.companyCandidates);
  const currentCompanyId = normalizeCompanyId(context.currentCompanyId);
  const isConversationContinuing = Boolean(context.isConversationContinuing);

  if (!isConversationContinuing || !currentCompanyId) {
    return context;
  }

  const alreadyExists = companyCandidates.some((item) => {
    return normalizeCompanyId(item.company_id) === currentCompanyId;
  });

  if (alreadyExists) {
    return {
      ...context,
      currentCompanyId,
      companyCandidates,
    };
  }

  const fallbackTopicLabel =
    (toSafeString(context.currentCompanyName) &&
    !looksLikeInternalId(context.currentCompanyName)
      ? toSafeString(context.currentCompanyName)
      : "") || getDefaultTopicLabelByCompanyId(currentCompanyId);

  const fallbackCandidate = {
    company_id: currentCompanyId,
    topic_label: fallbackTopicLabel,
    company_name: fallbackTopicLabel,
    keywords: [],
    score: 0,
    strongHitCount: 0,
    weakHitCount: 0,
    matchedTerms: [],
    priority: 999,
    sort_order: 9999,
    byConversationContext: true,
  };

  return {
    ...context,
    currentCompanyId,
    companyCandidates: [...companyCandidates, fallbackCandidate],
  };
}

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

    const existingCandidates = toSafeArray(merged.companyCandidates);
    const exists = existingCandidates.some((item) => {
      return normalizeCompanyId(item.company_id) === companyId;
    });

    if (!exists) {
      const judgeLabel = toSafeString(judgeResult.topicLabel);
      const safeJudgeLabel =
        judgeLabel &&
        judgeLabel !== DEFAULT_TOPIC_LABEL &&
        !looksLikeInternalId(judgeLabel)
          ? judgeLabel
          : getDefaultTopicLabelByCompanyId(companyId);

      merged.companyCandidates = [
        {
          company_id: companyId,
          topic_label: safeJudgeLabel,
          company_name: safeJudgeLabel,
          keywords: [],
          score: 1,
          strongHitCount: 0,
          weakHitCount: 0,
          matchedTerms: [],
          priority: 999,
          sort_order: 9999,
          byJudgeResult: true,
        },
        ...existingCandidates,
      ];
    }
  }

  return merged;
}

/**
 * 継続文脈からの補完は最小限にする
 * - no_topic では補完しない
 * - 今回メッセージ由来の候補があるなら補完しない
 * - 本当に候補ゼロの follow-up だけ currentCompanyId を使う
 */
function fillAnswerFromContinuingContext(answerResult = {}, context = {}) {
  const currentCompanyId = normalizeCompanyId(context.currentCompanyId);
  const isConversationContinuing = Boolean(context.isConversationContinuing);
  const companyCandidates = toSafeArray(context.companyCandidates);

  if (!isConversationContinuing || !currentCompanyId) {
    return answerResult;
  }

  if (answerResult.companyId) {
    return answerResult;
  }

  if (toSafeString(answerResult.judgement) === "no_topic") {
    return answerResult;
  }

  const hasFreshCandidate = companyCandidates.some((item) => {
    return !item.byConversationContext;
  });

  if (hasFreshCandidate) {
    return answerResult;
  }

  return {
    ...answerResult,
    companyId: currentCompanyId,
    matchedCompanyId: currentCompanyId,
  };
}

/**
 * 今回メッセージで拾えた候補の最上位 companyId
 * byConversationContext だけの候補は除外
 */
function getTopFreshCompanyId(context = {}) {
  const companyCandidates = toSafeArray(context.companyCandidates);

  const fresh = companyCandidates.filter((item) => !item.byConversationContext);

  if (fresh.length === 0) {
    return "";
  }

  return normalizeCompanyId(fresh[0].company_id);
}

/**
 * 最終 companyId 決定
 *
 * 優先順位:
 * 1. no_topic なら空
 * 2. answerResult の companyId / matchedCompanyId
 * 3. 今回メッセージ由来の top candidate
 * 4. 候補が本当にゼロのときだけ currentCompanyId
 */
function resolveFinalCompanyId(answerResult = {}, context = {}) {
  const judgement = toSafeString(answerResult.judgement);

  if (judgement === "no_topic") {
    return "";
  }

  const answerId = normalizeCompanyId(
    answerResult.companyId || answerResult.matchedCompanyId
  );
  if (answerId) return answerId;

  const topFreshCompanyId = getTopFreshCompanyId(context);
  if (topFreshCompanyId) return topFreshCompanyId;

  const companyCandidates = toSafeArray(context.companyCandidates);
  const hasFreshCandidate = companyCandidates.some((item) => !item.byConversationContext);

  if (!hasFreshCandidate) {
    return normalizeCompanyId(context.currentCompanyId);
  }

  return "";
}

/**
 * 最終 topicLabel 決定
 *
 * 優先順位:
 * 1. no_topic ならテーマ無し
 * 2. answerResult.topicLabel
 * 3. judgeResult.topicLabel
 * 4. finalCompanyId に対応する label
 * 5. DEFAULT_TOPIC_LABEL
 */
function resolveFinalTopicLabel(
  answerResult = {},
  judgeResult = {},
  context = {},
  finalCompanyId = ""
) {
  const judgement = toSafeString(answerResult.judgement);

  if (judgement === "no_topic") {
    return DEFAULT_TOPIC_LABEL;
  }

  const answerLabel = toSafeString(answerResult.topicLabel);
  if (
    answerLabel &&
    answerLabel !== DEFAULT_TOPIC_LABEL &&
    !looksLikeInternalId(answerLabel)
  ) {
    return answerLabel;
  }

  const judgeLabel = toSafeString(judgeResult.topicLabel);
  if (
    judgeLabel &&
    judgeLabel !== DEFAULT_TOPIC_LABEL &&
    !looksLikeInternalId(judgeLabel)
  ) {
    return judgeLabel;
  }

  if (finalCompanyId) {
    const labelFromFinalCompany = findTopicLabelByCompanyId(
      finalCompanyId,
      context.companyCandidates
    );
    if (labelFromFinalCompany) {
      return labelFromFinalCompany;
    }
  }

  return DEFAULT_TOPIC_LABEL;
}

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

    const rawContext = contextResult.data;
    const context = ensureContinuingCompanyCandidate(rawContext);

    const judgePhase = await runJudgeAI({
      rid,
      userMessage,
      ...context,
    });

    if (!judgePhase.success) throw new Error("judge failed");

    const judgeResult = judgePhase.data.judgeResult;

    if (judgeResult.needsClarification) {
      const debugData = {
        rid,
        stage: "needsClarification",
        companyCandidates: context.companyCandidates,
        currentCompanyId: normalizeCompanyId(context.currentCompanyId),
      };
      console.log("### V35 DEBUG NEEDS_CLARIFICATION ###", debugData);

      return {
        success: true,
        data: {
          replyText: buildFinalReplyText(
            DEFAULT_TOPIC_LABEL,
            buildClarificationReply(context.companyCandidates)
          ),
          topicLabel: DEFAULT_TOPIC_LABEL,
          companyId: "",
          matchedCompanyId: "",
          isConversationContinuing: Boolean(context.isConversationContinuing),
          currentCompanyId: normalizeCompanyId(context.currentCompanyId),
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

    let answerResult = normalizeAnswerResult(answerPhase.data.parsed);
    answerResult = fillAnswerFromContinuingContext(answerResult, mergedContext);

    const finalCompanyId = resolveFinalCompanyId(
      answerResult,
      mergedContext
    );

    const finalTopicLabel = resolveFinalTopicLabel(
      answerResult,
      judgeResult,
      mergedContext,
      finalCompanyId
    );

    const replyText = buildFinalReplyText(
      finalTopicLabel,
      answerResult.replyMessage
    );

    // ===== DEBUG LOGS START =====
    console.log("### V35 DEBUG INPUT ###", {
      rid,
      userMessage,
      rawCurrentCompanyId: rawContext.currentCompanyId || "",
      mergedCurrentCompanyId: mergedContext.currentCompanyId || "",
      isConversationContinuing: Boolean(mergedContext.isConversationContinuing),
    });

    console.log("### V35 DEBUG CANDIDATES ###", {
      rid,
      companyCandidates: (mergedContext.companyCandidates || []).map((item) => ({
        company_id: item.company_id || "",
        topic_label: item.topic_label || "",
        company_name: item.company_name || "",
        score: item.score ?? null,
        byConversationContext: Boolean(item.byConversationContext),
        byJudgeResult: Boolean(item.byJudgeResult),
      })),
    });

    console.log("### V35 DEBUG ANSWER_RESULT ###", {
      rid,
      answerResult,
      judgeResult,
    });

    console.log("### V35 FINAL OUT ###", {
      rid,
      judgement: answerResult?.judgement || "",
      parsedCompanyId: answerResult?.companyId || "",
      parsedMatchedCompanyId: answerResult?.matchedCompanyId || "",
      finalCompanyId,
      finalTopicLabel,
      currentCompanyId: normalizeCompanyId(mergedContext.currentCompanyId),
      replyText,
    });
    // ===== DEBUG LOGS END =====

    return {
      success: true,
      data: {
        replyText,
        topicLabel: finalTopicLabel,
        companyId: finalCompanyId,
        matchedCompanyId: finalCompanyId,
        isConversationContinuing: Boolean(mergedContext.isConversationContinuing),
        currentCompanyId: normalizeCompanyId(mergedContext.currentCompanyId),
      },
    };
  } catch (error) {
    console.log("### V35 DEBUG ERROR ###", {
      rid,
      bot_id,
      userId,
      userMessage,
      error: error?.message || String(error),
    });

    return {
      success: false,
      message: error.message,
      data: { rid, bot_id, userId, userMessage },
    };
  }
}

module.exports = {
  runV35,
};