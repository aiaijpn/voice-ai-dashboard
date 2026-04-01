"use strict";

/**
 * services/v35/buildV35Prompt.js
 *
 * 役割:
 * - V3.5 用の AI入力プロンプトを生成する
 * - userMessage / wiki候補 / stock候補 を AIに渡す
 * - JSON固定で返させる
 *
 * このファイルでやること:
 * - system prompt 生成
 * - user prompt 生成
 * - AIへ渡す input 構造を返す
 *
 * このファイルでやらないこと:
 * - OpenAI API 呼び出し
 * - JSON解析
 * - question_stock 保存
 */

const DEFAULT_TOPIC_LABEL = "テーマ無し";

/**
 * system prompt を作る
 */
function buildSystemPrompt() {
  return [
    "あなたはV3.5会話エンジンの中核AIです。",
    "目的は、ユーザ発話に対して、返答・未回答収集・wiki下書き生成を同時に行うことです。",
    "",
    "必須ルール:",
    "1. 必ずJSONのみを返してください。",
    "2. JSON以外の文章は一切出力しないでください。",
    "3. 与えられた company_wiki 候補があれば、それを優先的に検討してください。",
    "4. company_wiki 候補で十分に答えられる場合は judgement を wiki_answer にしてください。",
    "5. 未回答で、question_stock に追加すべき場合は stockAction を append にしてください。",
    "6. company_wiki に将来追加すべきと判断した場合は wikiDraft を生成してください。",
    "7. topicLabel は会話相手に見せる前提なので、短く自然な日本語にしてください。",
    `8. 該当テーマが弱い、または特定できない場合は topicLabel を "${DEFAULT_TOPIC_LABEL}" にしてください。`,
    "9. replyMessage はユーザ向けの自然な日本語にしてください。",
    "10. matchedCompanyId は該当企業がない場合は空文字にしてください。",
    "",
    "judgement の候補:",
    "- wiki_answer: wiki候補で回答可能",
    "- stock_append: 未回答としてstock追加すべき",
    "- general_reply: 一般返答のみ",
    "- no_topic: テーマ無し",
    "",
    "wikiAction の候補:",
    '- "none"',
    '- "draft"',
    "",
    "stockAction の候補:",
    '- "none"',
    '- "append"',
    "",
    "返却JSONの形式は必ず以下に従ってください:",
    "{",
    '  "topicLabel": "オーダースーツ金井",',
    '  "replyMessage": "返答文",',
    '  "matchedCompanyId": "kanai_suits",',
    '  "usedWiki": true,',
    '  "wikiAction": "none",',
    '  "wikiDraft": null,',
    '  "stockAction": "none",',
    '  "stockDraft": null,',
    '  "judgement": "wiki_answer"',
    "}",
    "",
    "wikiDraft を作る場合の形式:",
    "{",
    '  "company_id": "kanai_suits",',
    '  "question_pattern": "予約は必要ですか？",',
    '  "normalized_question": "予約は必要ですか？",',
    '  "answer_text": "ご予約をおすすめしております。",',
    '  "draft_reason": "未回答質問として今後wiki登録候補"', 
    "}",
    "",
    "stockDraft を作る場合の形式:",
    "{",
    '  "company_id": "kanai_suits",',
    '  "question": "予約は必要ですか？",',
    '  "normalized_question": "予約は必要ですか？",',
    '  "user_question": "予約は必要ですか？",',
    '  "question_category": "faq",',
    '  "draft_answer": "",',
    '  "draft_answer_source": "v35_ai"',
    "}",
  ].join("\n");
}

/**
 * user prompt を作る
 */
function buildUserPrompt({
  userMessage = "",
  companyWikiCandidates = [],
  questionStockCandidates = [],
}) {
  const safePayload = {
    userMessage: String(userMessage || ""),
    companyWikiCandidates: Array.isArray(companyWikiCandidates)
      ? companyWikiCandidates
      : [],
    questionStockCandidates: Array.isArray(questionStockCandidates)
      ? questionStockCandidates
      : [],
  };

  return [
    "以下の入力をもとに、必ずJSONのみで判定結果を返してください。",
    "",
    JSON.stringify(safePayload, null, 2),
  ].join("\n");
}

/**
 * メイン
 */
function buildV35Prompt(input = {}) {
  try {
    const systemPrompt = buildSystemPrompt();

    const userPrompt = buildUserPrompt({
      userMessage: input.userMessage,
      companyWikiCandidates: input.companyWikiCandidates,
      questionStockCandidates: input.questionStockCandidates,
    });

    return {
      success: true,
      message: "buildV35Prompt success",
      data: {
        systemPrompt,
        userPrompt,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error?.message || "buildV35Prompt failed",
      data: null,
    };
  }
}

module.exports = {
  DEFAULT_TOPIC_LABEL,
  buildSystemPrompt,
  buildUserPrompt,
  buildV35Prompt,
};