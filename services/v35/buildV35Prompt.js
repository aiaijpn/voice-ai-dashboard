"use strict";

/**
 * services/v35/buildV35Prompt.js
 *
 * 役割:
 * - V3.53 用の AI入力プロンプトを生成する
 * - userMessage / wiki候補 / stock候補 / company候補 / currentCompany を AIに渡す
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
 *
 * V3.53 の主目的:
 * - 「companyCandidates がある」だけで企業を出してしまう誤誘導を減らす
 * - currentCompanyId がある場合だけ、会話継続として企業文脈を使いやすくする
 * - 企業を出す / 出さない を AIに明示的に判断させる
 *
 * 今回の強化点:
 * - companyCandidates が 1件だけで、その内容が userMessage と明確に一致する場合は、
 *   その企業を積極採用してよいことを明文化
 */

const DEFAULT_TOPIC_LABEL = "テーマ無し";

/**
 * system prompt を作る
 */
function buildSystemPrompt() {
  return [
    "あなたはV3.53会話エンジンの中核AIです。",
    "目的は、ユーザ発話に対して、返答・未回答収集・wiki下書き生成を同時に行うことです。",
    "",
    "最重要ルール:",
    "1. 必ずJSONのみを返してください。",
    "2. JSON以外の文章は一切出力しないでください。",
    "3. replyMessage には、ユーザへ見せる回答本文だけを書いてください。",
    "4. topicLabel の表示文（例: 【スーツ金井】 や 【テーマ無し】⇒協賛企業から選択）はシステム側で付けます。replyMessage に topicLabel 表示を書かないでください。",
    "5. テーマ無しでも、ユーザの質問に一般的に答えられるなら、自然な回答本文を replyMessage に入れてください。",
    "6. company_wiki 候補で十分に答えられる場合は、それを最優先して judgement を wiki_answer にしてください。",
    "7. companyCandidates は補助候補です。companyCandidates が存在しても、それだけを理由に企業を確定してはいけません。",
    "8. 企業テーマが明確なとき、または currentCompanyId があり会話継続が明確なときだけ、topicLabel と matchedCompanyId を企業寄りにしてよいです。",
    "9. ただし、companyCandidates が1件のみで、その topic_label / company_name / keywords が userMessage と明確に一致する場合は、その企業を採用してよいです。",
    "10. 未回答で、question_stock に追加すべき場合は stockAction を append にしてください。",
    "11. company_wiki に将来追加すべきと判断した場合は wikiDraft を生成してください。",
    `12. 該当テーマが弱い、または特定できない場合は topicLabel を "${DEFAULT_TOPIC_LABEL}" にしてください。`,
    "13. matchedCompanyId は該当企業がない場合は空文字にしてください。",
    "14. companyCandidates が空で、currentCompanyId もなく、企業テーマの根拠が弱い場合は、企業を無理に選ばずテーマ無しを優先してください。",
    "",
    "判断優先順位:",
    "1. companyWikiCandidates",
    "2. currentCompanyId と会話継続性",
    "3. companyCandidates",
    "4. questionStockCandidates",
    `5. ${DEFAULT_TOPIC_LABEL}`,
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
    "- 候補が複数ある場合は慎重に判断してください",
    "- 候補が1件だけで、userMessage と自然に結びつくなら、その企業を優先採用してよいです",
    "- 例: userMessage が「スーツを作りたい」で、companyCandidates がスーツ金井だけなら、その企業を採用してよいです",
    "- 一般質問、雑談、広い話題、無関係話題なら企業を出さず テーマ無し にしてください",
    "",
    "currentCompanyId の扱い:",
    "- currentCompanyId は、直前まで会話で使われていた企業IDです",
    "- isConversationContinuing が true でも、現在のユーザ発話が明らかに別話題なら無理に引き継がないでください",
    "- ただし、短い追撃質問（例: 駐車場は？ 予約は？ 何時まで？）は currentCompanyId を強く参考にしてよいです",
    "- currentCompanyName は補助情報です",
    "",
    "一般質問の扱い:",
    "- 天気、AI活用、交流会のコツなど、一般的に答えられる内容は、テーマ無しでも簡潔に答える",
    "- 企業に寄せる根拠が弱い場合は、一般回答 + テーマ無し を優先する",
    "",
    "典型例:",
    "- ユーザ: スーツを作りたい -> companyCandidates がスーツ金井のみなら企業を採用してよい",
    "- ユーザ: 駐車場は？ -> currentCompanyId があり会話継続ならその企業を採用してよい",
    "- ユーザ: 駐車場は？ -> currentCompanyId がなく、企業手がかりも弱いならテーマ無し",
    "- ユーザ: 今日の天気は？ -> テーマ無し",
    "- ユーザ: AI活用のコツは？ -> 一般回答できるならテーマ無し",
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
    "usedWiki の方針:",
    "- companyWikiCandidates の回答を使って答えた場合のみ true",
    "- 一般回答や companyCandidates ベースだけの推定回答では false",
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
  currentCompanyId = "",
  currentCompanyName = "",
  isConversationContinuing = false,
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
    currentCompanyId: String(currentCompanyId || ""),
    currentCompanyName: String(currentCompanyName || ""),
    isConversationContinuing: Boolean(isConversationContinuing),
  };

  return [
    "以下の入力をもとに、必ずJSONのみで判定結果を返してください。",
    "replyMessage には回答本文のみを書いてください。topicLabel表示は書かないでください。",
    "companyWikiCandidates が十分なら最優先してください。",
    "companyCandidates は補助候補ですが、1件のみで userMessage と明確に一致する場合は採用してよいです。",
    "currentCompanyId があり、かつ今回の発話が会話継続と見なせる場合のみ、企業文脈を優先してよいです。",
    `根拠が弱ければ topicLabel は "${DEFAULT_TOPIC_LABEL}"、matchedCompanyId は空文字にしてください。`,
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
      currentCompanyId: input.currentCompanyId,
      currentCompanyName: input.currentCompanyName,
      isConversationContinuing: input.isConversationContinuing,
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