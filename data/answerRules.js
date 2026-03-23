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
    linked_company_id: "yabuki_fanclub",
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
    linked_company_id: "winebase_ginza",
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
];

module.exports = {
  answerRules,
};