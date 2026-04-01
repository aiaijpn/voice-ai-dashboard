"use strict";

/**
 * services/v35/buildV35Prompt.js
 *
 * 役割:
 * - V3.52 用の AI入力プロンプトを生成する
 * - userMessage / wiki候補 / stock候補 / company候補 を AIに渡す
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
    "あなたはV3.52会話エンジンの中核AIです。",
    "目的は、ユーザ発話に対して、返答・未回答収集・wiki下書き生成を同時に行うことです。",
    "",
    "最重要ルール:",
    "1. 必ずJSONのみを返してください。",
    "2. JSON以外の文章は一切出力しないでください。",
    "3. replyMessage には、ユーザへ見せる回答本文だけを書いてください。",
    "4. topicLabel の表示文（例: 【スーツ金井】 や 【テーマ無し】⇒協賛企業から選択）はシステム側で付けます。replyMessage に topicLabel 表示を書かないでください。",
    "5. テーマ無しでも、ユーザの質問に一般的に答えられるなら、自然な回答本文を replyMessage に入れてください。",
    "6. company_wiki 候補で十分に答えられる場合は、それを最優先して judgement を wiki_answer にしてください。",
    "7. company_wiki 候補が弱い場合は、companyCandidates を見て topicLabel と matchedCompanyId を判断してよいです。",
    "8. 未回答で、question_stock に追加すべき場合は stockAction を append にしてください。",
    "9. company_wiki に将来追加すべきと判断した場合は wikiDraft を生成してください。",
    `10. 該当テーマが弱い、または特定できない場合は topicLabel を "${DEFAULT_TOPIC_LABEL}" にしてください。`,
    "11. matchedCompanyId は該当企業がない場合は空文字にしてください。",
    "",
    "判断優先順位:",
    "1. companyWikiCandidates",
    "2. companyCandidates",
    "3. questionStockCandidates",
    `4. ${DEFAULT_TOPIC_LABEL}`,
    "",
    "topicLabel の方針:",
    "- 協賛企業や会話テーマが明確なら、その短い表示名を入れる",
    `- 明確でなければ "${DEFAULT_TOPIC_LABEL}" を入れる`,
    "- 例: スーツ金井, 法律池田, ワイン小澤, テーマ無し",
    "",
    "companyCandidates の扱い:",
    "- companyCandidates は、company_master シートを元にコード側で絞り込まれたテーマ候補です",
    "- topic_label を優先参照して topicLabel を判断してよいです",
    "- company_id を使って matchedCompanyId を決めてよいです",
    "- keywords は補助情報です",
    "- ただし、根拠が弱い場合は無理に会社を決め打ちせず テーマ無し にしてください",
    "",
    "replyMessage の方針:",
    "- できるだけ自然な日本語で答える",
    "- 長すぎず、会話が続けやすい文にする",
    "- topicLabel 表示は書かない",
    "",
    "一般質問の扱い:",
    "- 天気、AI活用、交流会のコツなど、一般的に答えられる内容は、テーマ無しでも簡潔に答える",
    "- ただし、協賛企業テーマが明確ならそちらを優先して判断する",
    "",
    "judgement の候補:",
    '- "wiki_answer": wiki候補で回答可能',
    '- "stock_append": 未回答としてstock追加すべき',
    '- "general_reply": 一般返答のみ',
    '- "no_topic": テーマ無し',
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
    '  "topicLabel": "スーツ金井",',
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
  companyCandidates = [],
}) {
  const safePayload = {
    userMessage: String(userMessage || ""),
    companyWikiCandidates: Array.isArray(companyWikiCandidates)
      ? companyWikiCandidates
      : [],
    questionStockCandidates: Array.isArray(questionStockCandidates)
      ? questionStockCandidates
      : [],
    companyCandidates: Array.isArray(companyCandidates)
      ? companyCandidates
      : [],
  };

  return [
    "以下の入力をもとに、必ずJSONのみで判定結果を返してください。",
    "replyMessage には回答本文のみを書いてください。topicLabel表示は書かないでください。",
    "companyWikiCandidates が十分なら最優先してください。",
    "companyWikiCandidates が弱い場合は、companyCandidates を使って topicLabel と matchedCompanyId を判断してよいです。",
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
      companyCandidates: input.companyCandidates,
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