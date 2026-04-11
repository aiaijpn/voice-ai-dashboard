"use strict";

/**
 * services/v35/companyJudgeService.js
 *
 * 役割:
 * - V3.54 用の「企業判定専用AI」を呼ぶ前段サービス
 * - code側で明確な場合は AI を呼ばずに即決する
 * - 曖昧な場合だけ judge AI 用 prompt を返す
 *
 * 方針:
 * - 最大2回AI構成
 * - 毎回2回呼ばない
 * - 明確なら code で即決
 * - 曖昧なら judge AI に委譲
 *
 * このファイルでやること:
 * - 判定用の前処理
 * - 1回で済むか / judge AI が必要かを決める
 * - judge AI 用 systemPrompt / userPrompt を構築する
 *
 * このファイルでやらないこと:
 * - 最終回答生成
 * - wiki保存 / stock保存
 * - OpenAI API の実呼び出し
 */

function toSafeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * company_id 正規化
 *
 * 目的:
 * - 移行期間のID揺れを吸収する
 * - 正本は最終的にシート側で統一する前提
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
 * 上位候補を返す
 *
 * 前提:
 * - collectV35Context → companyService の結果は score降順想定
 * - 念のため score / strongHitCount で再ソートしておく
 */
function pickTopCompanyCandidate(companyCandidates = []) {
  const items = toSafeArray(companyCandidates).slice();

  if (items.length === 0) {
    return null;
  }

  items.sort((a, b) => {
    const scoreA = Number(a?.score || 0);
    const scoreB = Number(b?.score || 0);
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    const strongA = Number(a?.strongHitCount || 0);
    const strongB = Number(b?.strongHitCount || 0);
    if (strongB !== strongA) {
      return strongB - strongA;
    }

    const priorityA = Number(a?.priority || 0);
    const priorityB = Number(b?.priority || 0);
    if (priorityB !== priorityA) {
      return priorityB - priorityA;
    }

    return Number(a?.sort_order || 9999) - Number(b?.sort_order || 9999);
  });

  return items[0] || null;
}

/**
 * code側で即決できるトップ候補か
 *
 * 目安:
 * - strongHitCount >= 2 かつ score >= 20 → 確定級
 * - または strongHitCount >= 3 → 確定級
 * - または score >= 30 → 確定級
 *
 * 備考:
 * - 候補数が複数でも、トップが十分強ければ skip_ai にする
 */
function isStrongTopCandidate(candidate = {}) {
  const score = Number(candidate?.score || 0);
  const strongHitCount = Number(candidate?.strongHitCount || 0);

  if (strongHitCount >= 2 && score >= 20) {
    return true;
  }

  if (strongHitCount >= 3) {
    return true;
  }

  if (score >= 30) {
    return true;
  }

  return false;
}

/**
 * code側だけで即決できるか
 *
 * 優先:
 * 1. wiki候補あり
 * 2. currentCompanyId があり継続会話が強い
 * 3. トップ候補が十分強い
 *
 * 注意:
 * - ここで返す matchedCompanyId は「最終確定」ではなく
 *   code側の参考情報として扱う
 * - conversation_continuing は、後段の最終決定に委ねるため
 *   matchedCompanyId を返さず、reason だけ返す
 */
function shouldSkipJudgeAI(context = {}) {
  const companyWikiCandidates = toSafeArray(context.companyWikiCandidates);
  const companyCandidates = toSafeArray(context.companyCandidates);
  const currentCompanyId = normalizeCompanyId(context.currentCompanyId);
  const isConversationContinuing = Boolean(context.isConversationContinuing);

  if (companyWikiCandidates.length >= 1) {
    return {
      skip: true,
      reason: "wiki_candidate_exists",
      matchedCompanyId: normalizeCompanyId(
        companyWikiCandidates[0]?.company_id
      ),
      confidence: "high",
    };
  }

  if (currentCompanyId && isConversationContinuing) {
    return {
      skip: true,
      reason: "conversation_continuing",
      matchedCompanyId: "",
      confidence: "high",
    };
  }

  const top = pickTopCompanyCandidate(companyCandidates);

  if (top && isStrongTopCandidate(top)) {
    return {
      skip: true,
      reason: "top_candidate_strong_enough",
      matchedCompanyId: normalizeCompanyId(top.company_id),
      confidence: "high",
    };
  }

  return {
    skip: false,
    reason: "judge_ai_needed",
    matchedCompanyId: "",
    confidence: "low",
  };
}

/**
 * judge AI 用 system prompt
 */
function buildJudgeSystemPrompt() {
  return [
    "あなたはV3.54の企業判定専用AIです。",
    "役割は、ユーザ発話が企業テーマに属するか、属するならどの企業かを判定することだけです。",
    "",
    "最重要ルール:",
    "1. 必ずJSONのみを返してください。",
    "2. JSON以外の文章は一切出力しないでください。",
    "3. この段階ではユーザへの最終回答文を書かないでください。",
    "4. 企業テーマが不明瞭なら、無理に企業を確定しないでください。",
    "5. currentCompanyId があっても、今回の発話が明らかに別話題なら引き継がないでください。",
    "6. companyCandidates はコード側で絞られた候補です。最重要な判断材料ですが、根拠が弱いなら採用しないでください。",
    "7. 天気、一般知識、雑談、広い相談などは企業テーマにしないでください。",
    "8. 短い追撃質問（例: 駐車場は？ 予約は？）は、会話継続性があれば currentCompanyId を強く考慮してよいです。",
    "",
    "返却JSONの形式は必ず以下に従ってください:",
    "{",
    '  "shouldUseCompany": true,',
    '  "matchedCompanyId": "kanai_suit",',
    '  "confidence": "high",',
    '  "needsClarification": false,',
    '  "topicLabel": "スーツ金井",',
    '  "reason": "userMessage がスーツ作成意図で、候補が強く一致しているため"',
    "}",
    "",
    "各項目のルール:",
    '- shouldUseCompany: true / false',
    '- matchedCompanyId: 企業がなければ空文字',
    '- confidence: "high" / "medium" / "low"',
    '- needsClarification: true / false',
    '- topicLabel: 企業テーマが明確なら短い表示名。明確でなければ「テーマ無し」',
    '- reason: 内部向けの簡潔な理由',
    "",
    "判定方針:",
    "1. companyWikiCandidates が十分なら、その企業を優先",
    "2. currentCompanyId + 継続会話が明確なら、その企業を優先",
    "3. companyCandidates のトップ候補が強いなら、その企業を採用",
    "4. companyCandidates が複数で僅差なら、無理に決めず needsClarification を true にしてよい",
    "5. 一般質問なら shouldUseCompany=false, matchedCompanyId='' とする",
  ].join("\n");
}

/**
 * judge AI 用 user prompt
 */
function buildJudgeUserPrompt(input = {}) {
  const payload = {
    userMessage: toSafeString(input.userMessage),
    companyWikiCandidates: toSafeArray(input.companyWikiCandidates),
    companyCandidates: toSafeArray(input.companyCandidates),
    currentCompanyId: normalizeCompanyId(input.currentCompanyId),
    currentCompanyName: toSafeString(input.currentCompanyName),
    isConversationContinuing: Boolean(input.isConversationContinuing),
  };

  return [
    "以下の情報から企業テーマ判定のみを行ってください。",
    "最終回答文は不要です。必ずJSONのみで返してください。",
    "",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

/**
 * judge AI 結果の最低限整形
 *
 * 方針:
 * - judgeResult は「参考情報」
 * - 最終 companyId は後段で決める
 * - matchedCompanyId は、明確に来たときだけ残す
 */
function normalizeJudgeResult(result = {}) {
  const rawMatchedCompanyId = normalizeCompanyId(result.matchedCompanyId);
  const reason = toSafeString(result.reason);
  const confidence = ["high", "medium", "low"].includes(result.confidence)
    ? result.confidence
    : "low";

  let normalizedMatchedCompanyId = rawMatchedCompanyId;

  // 継続理由だけで入ってきた companyId は、ここで消す
  if (reason === "conversation_continuing") {
    normalizedMatchedCompanyId = "";
  }

  return {
    shouldUseCompany: Boolean(result.shouldUseCompany),
    matchedCompanyId: normalizedMatchedCompanyId,
    confidence,
    needsClarification: Boolean(result.needsClarification),
    topicLabel: toSafeString(result.topicLabel) || "テーマ無し",
    reason,
  };
}

/**
 * メイン
 *
 * 戻り値パターン:
 * 1. code側で即決
 * 2. judge AI が必要 → prompt返却
 */
function prepareCompanyJudge(input = {}) {
  try {
    const precheck = shouldSkipJudgeAI(input);

    if (precheck.skip) {
      return {
        success: true,
        message: "company judge skipped by code decision",
        data: {
          mode: "skip_ai",
          judgeResult: normalizeJudgeResult({
            shouldUseCompany: Boolean(
              precheck.matchedCompanyId || precheck.reason === "conversation_continuing"
            ),
            matchedCompanyId: precheck.matchedCompanyId,
            confidence: precheck.confidence,
            needsClarification: false,
            topicLabel: precheck.matchedCompanyId ? "" : "テーマ無し",
            reason: precheck.reason,
          }),
          systemPrompt: "",
          userPrompt: "",
        },
      };
    }

    const systemPrompt = buildJudgeSystemPrompt();
    const userPrompt = buildJudgeUserPrompt(input);

    return {
      success: true,
      message: "company judge prompt prepared",
      data: {
        mode: "need_ai",
        judgeResult: null,
        systemPrompt,
        userPrompt,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error?.message || "prepareCompanyJudge failed",
      data: null,
    };
  }
}

module.exports = {
  toSafeString,
  toSafeArray,
  normalizeCompanyId,
  pickTopCompanyCandidate,
  isStrongTopCandidate,
  shouldSkipJudgeAI,
  buildJudgeSystemPrompt,
  buildJudgeUserPrompt,
  normalizeJudgeResult,
  prepareCompanyJudge,
};