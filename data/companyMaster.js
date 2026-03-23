"use strict";

/**
 * 企業マスター（V3 / CommonJS）
 *
 * 目的：
 * - 協賛企業一覧ページの生成
 * - AI会話内での企業候補抽出
 * - 将来のDB化・管理画面・課金制御に対応
 *
 * 方針：
 * - “完成形”ではなく“拡張前提の最小構造”
 * - 企業情報の参照元はこのマスターに一元化する
 * - ただし検索ロジックは services/companyService.js に寄せる
 *
 * 注意：
 * - このファイルは「データ置き場」を主責務にする
 * - 複雑な検索・優先度計算はここに書かない
 */

const companyMaster = [
  // ===============================
  // 三味線ファンクラブ 矢吹
  // ===============================
  {
    id: "yabuki_fanclub", // 一意ID（将来DB化時の主キー候補）
    type: "company", // company / divider

    name: "三味線ファンクラブ 矢吹", // 正式名称（内部・将来用）
    display_name: "三味線ファンクラブ　矢吹", // UI表示用

    category: "文化・音楽",
    tags: ["三味線", "和文化", "音楽", "趣味"],

    short_pitch: "和の文化に触れてみませんか。",
    description: "三味線や和文化を楽しむコミュニティ。",

    url: "https://example.com/yabuki",

    // ===== 表示制御 =====
    is_active: true, // false なら完全非表示
    show_in_list: true, // 協賛一覧に表示
    show_in_ai: true, // AI会話候補に含める

    // ===== 将来の優先制御余地 =====
    plan_rank: 1, // 0=未掲載 / 1=通常 / 2=上位 / 3=最上位
    priority: 10, // AI表示の優先度（V3では単純比較のみ想定）

    // ===== 一覧表示順 =====
    sort_order: 10,
  },

  // ===============================
  // 池田法律相談室
  // ===============================
  {
    id: "ikeda_law",
    type: "company",
    name: "池田法律相談室",
    display_name: "池田法律相談室",
    category: "法律",
    tags: ["法律", "弁護士", "相談", "トラブル"],
    short_pitch: "法律のご相談なら。",
    description: "法律相談に対応。",
    url: "https://example.com/ikeda-law",
    is_active: true,
    show_in_list: true,
    show_in_ai: true,
    plan_rank: 1,
    priority: 10,
    sort_order: 20,
  },

  // ===============================
  // オーダースーツの金井
  // ===============================
  {
    id: "kanai_suit",
    type: "company",
    name: "オーダースーツの金井",
    display_name: "オーダースーツの金井",
    category: "スーツ",
    tags: ["スーツ", "オーダー", "装い", "身だしなみ"],
    short_pitch: "装いへの気配り、いかがですか。",
    description: "オーダースーツのご相談に対応。",
    url: "https://example.com/kanai-suit",
    is_active: true,
    show_in_list: true,
    show_in_ai: true,
    plan_rank: 2,
    priority: 20,
    sort_order: 30,
  },

  // ===============================
  // 西川ヘレン美容医療院
  // ===============================
  {
    id: "nishikawa_helen",
    type: "company",
    name: "西川ヘレン美容医療院",
    display_name: "西川ヘレン美容医療院",
    category: "美容医療",
    tags: ["美容", "医療", "肌", "若返り"],
    short_pitch: "美容医療のご相談はこちら。",
    description: "美容医療の案内。",
    url: "https://example.com/nishikawa-helen",
    is_active: true,
    show_in_list: true,
    show_in_ai: true,
    plan_rank: 1,
    priority: 10,
    sort_order: 40,
  },

  // ===============================
  // 相続対策なら尾形
  // ===============================
  {
    id: "ogata_souzoku",
    type: "company",
    name: "相続対策なら尾形",
    display_name: "相続対策なら尾形",
    category: "相続",
    tags: ["相続", "資産", "税", "相談"],
    short_pitch: "相続対策のご相談なら。",
    description: "相続対策の相談先。",
    url: "https://example.com/ogata",
    is_active: true,
    show_in_list: true,
    show_in_ai: true,
    plan_rank: 1,
    priority: 10,
    sort_order: 50,
  },

  // ===============================
  // ザ・ワインベース銀座
  // ===============================
  {
    id: "winebase_ginza",
    type: "company",
    name: "ザ・ワインベース銀座",
    display_name: "ザ・ワインベース銀座",
    category: "ワインバー",
    tags: ["ワイン", "バー", "接待", "銀座"],
    short_pitch: "接客に嗜みのグレードアップを。",
    description: "ワインと会話を楽しめる場。",
    url: "https://example.com/winebase-ginza",
    is_active: true,
    show_in_list: true,
    show_in_ai: true,
    plan_rank: 1,
    priority: 10,
    sort_order: 60,
  },

  // ===============================
  // 区切り線（UI用）
  // ===============================
  {
    id: "divider_01",
    type: "divider",
    label: "--------------------",
    show_in_list: true,
    sort_order: 70,
  },

  // ===============================
  // AIインテグレーションの高村
  // ===============================
  {
    id: "takamura_ai",
    type: "company",
    name: "AIインテグレーションの高村",
    display_name: "AIインテグレーションの高村",
    category: "AI導入支援",
    tags: ["AI", "業務効率", "自動化", "相談"],
    short_pitch: "AIを業務に組み込みたい方へ。",
    description: "AI導入・業務効率化の支援。",
    url: "https://example.com/takamura-ai",
    is_active: true,
    show_in_list: true,
    show_in_ai: true,
    plan_rank: 3,
    priority: 30,
    sort_order: 80,
  },
];

module.exports = {
  companyMaster,
};