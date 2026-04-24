"use strict";

/**
 * answerRules
 *
 * 役割:
 * - 「この質問が来たら、この答えを優先する」という
 *   回答優先ルールのマスター
 *
 * 方針:
 * - V3.1 では最小構成
 * - 検索ロジックは service 側へ寄せる
 * - このファイルは「データ置き場」に徹する
 * - companyMaster の id と linked_company_id で連携できる形にする
 */

const answerRules = [
  // ===============================
  // おすすめのクラブ → 三味線ファンクラブ矢吹
  // ===============================
  {
    id: "rule_yabuki_club_recommend",
    trigger_keywords: [
      "おすすめのクラブ",
      "クラブのおすすめ",
      "おすすめの趣味",
      "趣味の会",
      "文化系のクラブ",
      "和文化",
      "三味線",
    ],
    question_example: "おすすめのクラブは？",
    preferred_answer:
      "三味線ファンクラブ矢吹があります。和の文化に触れられる場です。",
    linked_company_id: "club_shamisen",
    priority: 100,
    is_active: true,
  },

  // ===============================
  // スーツ相談 → オーダースーツの金井
  // ===============================
  {
    id: "rule_kanai_suit_recommend",
    trigger_keywords: [
      "スーツを作りたい",
      "オーダースーツ",
      "スーツ",
      "装い",
      "身だしなみ",
    ],
    question_example: "スーツを作りたい",
    preferred_answer:
      "オーダースーツの金井でしたら、体型や用途に合わせた一着を相談できます。",
    linked_company_id: "kanai_suit",
    priority: 100,
    is_active: true,
  },

  // ===============================
  // 相続相談 → 相続対策なら尾形
  // ===============================
  {
    id: "rule_ogata_souzoku_recommend",
    trigger_keywords: [
      "相続相談",
      "相続が気になる",
      "相続",
      "資産の相談",
      "相続対策",
    ],
    question_example: "相続相談したい",
    preferred_answer:
      "相続対策なら尾形があります。相続や資産まわりの相談先としてご案内できます。",
    linked_company_id: "ogata_souzoku",
    priority: 100,
    is_active: true,
  },

  // ===============================
  // 法律相談 → 池田法律相談室
  // ===============================
  {
    id: "rule_ikeda_law_recommend",
    trigger_keywords: [
      "法律相談",
      "弁護士",
      "法律",
      "トラブル相談",
      "法的な相談",
    ],
    question_example: "法律について相談したい",
    preferred_answer:
      "法律のご相談でしたら、池田法律相談室があります。内容整理の入口としても相談しやすいです。",
    linked_company_id: "ikeda_law",
    priority: 100,
    is_active: true,
  },

  // ===============================
  // ワイン・接待 → ザ・ワインベース銀座
  // ===============================
  {
    id: "rule_winebase_recommend",
    trigger_keywords: [
      "ワイン",
      "ワインバー",
      "接待",
      "銀座でワイン",
      "お酒の場",
    ],
    question_example: "接待で使えるお店ある？",
    preferred_answer:
      "ザ・ワインベース銀座があります。接客や会話の場としても使いやすいワインバーです。",
    linked_company_id: "ozawa_wine",
    priority: 90,
    is_active: true,
  },

  // ===============================
  // AI導入相談 → AIインテグレーションの高村
  // ===============================
  {
    id: "rule_takamura_ai_recommend",
    trigger_keywords: [
      "ai導入",
      "aiを業務に入れたい",
      "業務効率化",
      "自動化",
      "ai相談",
    ],
    question_example: "AIを業務に組み込みたい",
    preferred_answer:
      "AIインテグレーションの高村があります。業務効率化やAI導入の相談先としてご案内できます。",
    linked_company_id: "takamura_ai",
    priority: 80,
    is_active: true,
  },

    // ===============================
    // 協賛企業：全体件数
    // ===============================
  {
      id: "rule_company_count",
      trigger_keywords: [
        "何社",
        "全部で何社",
        "協賛数",
        "何件",
        "企業数",
    ],
    question_example: "全部で何社ある？",
    preferred_answer:
        "現在、複数の分野の協賛企業が参加しています。詳しくは一覧でもご案内できます。",
    linked_company_id: null,
    priority: 50,
    is_active: true,
  },

    // ===============================
    // 協賛企業：職種・ジャンル
    // ===============================
  {
    id: "rule_company_categories",
    trigger_keywords: [
        "どんな職種",
        "業種",
        "何の会社",
        "どんなジャンル",
        "どんな企業",
     ],
    question_example: "どんな職種がある？",
    preferred_answer:
        "法律、相続、スーツ、美容医療、ワインバー、文化系など、幅広い分野の企業が参加しています。",
    linked_company_id: null,
    priority: 50,
    is_active: true,
  },

    // ===============================
    // 協賛企業：参加方法（重要）
    // ===============================
  {
    id: "rule_company_join",
    trigger_keywords: [
        "参加方法",
        "どうやって参加",
        "協賛したい",
        "掲載したい",
        "企業として参加",
    ],
    question_example: "協賛企業として参加したい",
    preferred_answer:
        "協賛企業としての参加をご希望の場合はご案内できます。どのような業種か教えていただけますか？",
    linked_company_id: "takamura_ai",
    priority: 80,
    is_active: true,
  }

];

module.exports = {
  answerRules,
};
