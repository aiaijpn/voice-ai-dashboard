"use strict";

const { getAllCompaniesFromSheet } = require("./companySheetService");

/**
 * TRUE判定
 */
function isTrue(value) {
  const v = String(value || "").toLowerCase().trim();
  return v === "true" || v === "1";
}

/**
 * 基本正規化
 */
function normalize(text = "") {
  return String(text || "").toLowerCase().trim();
}

/**
 * 比較用正規化
 *
 * 方針:
 * - 小文字化
 * - 前後空白除去
 * - 全角空白除去
 * - 記号ゆれを軽く吸収
 * - 長音/句読点/疑問符などを落とす
 *
 * 注意:
 * - ここでは意味変換しない
 * - 意味変換は expandSynonyms 側で扱う
 */
function normalizeForMatch(text = "") {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[　\s]+/g, "")
    .replace(/[!！?？、。，．,.・/／]/g, "")
    .replace(/[ーｰ\-]/g, "");
}

/**
 * タグ分解
 */
function parseTags(tags = "") {
  return String(tags || "")
    .split(/[,、\/／\n]+/)
    .map((t) => String(t || "").trim())
    .filter(Boolean);
}

/**
 * tags を indexベースで分割
 *
 * 検証用一時仕様:
 * - 前10   = strong
 * - 中10   = general
 * - 後10   = weak
 * - 31個目以降は無視
 */
function splitTagsByStrength(tags = []) {
  const strong = [];
  const general = [];
  const weak = [];

  tags.forEach((tag, index) => {
    if (index < 10) {
      strong.push(tag);
    } else if (index < 20) {
      general.push(tag);
    } else if (index < 30) {
      weak.push(tag);
    }
  });

  return { strong, general, weak };
}

/**
 * 協賛一覧
 */
async function getCompaniesForList() {
  const companyMaster = await getAllCompaniesFromSheet();

  return companyMaster
    .filter((item) => isTrue(item.show_in_html))
    .sort(
      (a, b) => Number(a.sort_order || 9999) - Number(b.sort_order || 9999)
    );
}

/**
 * ID取得
 */
async function getCompanyById(id = "") {
  const companyMaster = await getAllCompaniesFromSheet();
  const targetId = String(id || "").trim();

  if (!targetId) {
    return undefined;
  }

  return companyMaster.find((item) => item.company_id === targetId);
}

/**
 * 弱い共通語
 *
 * 目的:
 * - どの会社にも広く刺さる語を強く評価しすぎない
 * - 「相談」「予約」だけで会社が決まる事故を避ける
 *
 * 注意:
 * - これは tags の weak とは別の「全体事故防止ルール」
 */
const WEAK_GENERIC_WORDS = new Set([
  "相談",
  "予約",
  "来店",
  "場所",
  "どこ",
  "料金",
  "価格",
  "いくら",
  "値段",
  "納期",
  "駐車場",
  "イベント",
  "ライブ",
  "体験",
  "初心者",
]);

/**
 * 表記ゆれ・同義語辞書
 *
 * 方針:
 * - 会社個別ではなく意味単位で持つ
 * - 将来増えてもここだけ保守すればよい
 * - tags に寄せた語へ変換する
 *
 * 注意:
 * - ここは「意味補助」
 * - 企業決定は company 側データと score で行う
 */
const SYNONYM_RULES = [
  // スーツ系
  { from: /すーつ|すつ|スーツつくりたい|すーつつくりたい/g, to: "スーツ" },
  { from: /オーダーの服|オーダー服|オーダーメイドの服/g, to: "オーダースーツ" },
  { from: /背広/g, to: "スーツ" },
  { from: /フォーマル/g, to: "礼服" },

  // 法律系
  { from: /法的/g, to: "法律" },
  { from: /弁護士さん/g, to: "弁護士" },
  { from: /ちょい相談|軽く相談|少し相談/g, to: "相談" },
  { from: /法律のこと/g, to: "法律" },

  // 相続系
  { from: /相続のこと/g, to: "相続" },
  { from: /生前整理/g, to: "生前対策" },

  // 三味線系
  { from: /しゃみせん/g, to: "三味線" },
  { from: /津軽しゃみせん/g, to: "津軽三味線" },
  { from: /観たい三味線|見る三味線/g, to: "観る三味線" },

  // AI系
  { from: /人工知能/g, to: "AI" },
  { from: /業務自動化/g, to: "自動化" },
  { from: /効率化/g, to: "業務効率化" },
];

/**
 * 同義語展開
 *
 * 戻り値:
 * - 原文 + 同義語変換後語群
 */
function expandUserVariants(userMessage = "") {
  const raw = String(userMessage || "").trim();
  const variants = new Set();

  if (!raw) {
    return [];
  }

  variants.add(raw);

  let expanded = raw;
  for (const rule of SYNONYM_RULES) {
    expanded = expanded.replace(rule.from, rule.to);
  }
  variants.add(expanded);

  /**
   * 単語追加型の補助
   * 例:
   * - 「弁護士にちょい相談」 → 「弁護士」「相談」
   * - 「法的なトラブル」 → 「法律」「トラブル」
   */
  if (/弁護士/.test(raw)) variants.add("弁護士");
  if (/法律|法的/.test(raw)) variants.add("法律");
  if (/相談/.test(raw)) variants.add("相談");
  if (/相続|遺産|遺言/.test(raw)) variants.add("相続");
  if (/スーツ|礼服|採寸|仕立て|テーラー|オーダー/.test(raw)) {
    variants.add("スーツ");
  }

  return Array.from(variants).filter(Boolean);
}

/**
 * 比較対象語群を作る
 *
 * 優先:
 * - short_name
 * - name
 * - category
 * - tags
 *
 * 戻り値:
 * - all     : 全比較対象
 * - strong  : tags前10
 * - general : tags中10
 * - weak    : tags後10
 */
function buildCompanyTerms(company = {}) {
  const baseTerms = [];

  if (company.short_name) baseTerms.push(String(company.short_name).trim());
  if (company.name) baseTerms.push(String(company.name).trim());
  if (company.category) baseTerms.push(String(company.category).trim());

  const tags = parseTags(company.tags);
  const { strong, general, weak } = splitTagsByStrength(tags);

  return {
    all: Array.from(new Set([...baseTerms, ...strong, ...general, ...weak])),
    strong,
    general,
    weak,
  };
}

/**
 * 2語の一致強度を返す
 *
 * score方針:
 * - 完全一致 > 部分一致
 * - strong > general > weak
 * - ただし全体事故防止語は weak 扱いを優先
 */
function scoreTermAgainstVariant(term = "", variant = "", strength = "general") {
  const rawTerm = String(term || "").trim();
  const rawVariant = String(variant || "").trim();

  if (!rawTerm || !rawVariant) {
    return 0;
  }

  const termN = normalizeForMatch(rawTerm);
  const variantN = normalizeForMatch(rawVariant);

  if (!termN || !variantN) {
    return 0;
  }

  const isWeakGlobal =
    WEAK_GENERIC_WORDS.has(rawTerm) || WEAK_GENERIC_WORDS.has(termN);

  const SCORE = {
    strong: { exact: 12, partial: 7 },
    general: { exact: 8, partial: 4 },
    weak: { exact: 2, partial: 1 },
  };

  const type = isWeakGlobal ? "weak" : strength;

  /**
   * 完全一致
   */
  if (termN === variantN) {
    return SCORE[type].exact;
  }

  /**
   * 部分一致
   */
  if (variantN.includes(termN) || termN.includes(variantN)) {
    return SCORE[type].partial;
  }

  return 0;
}

/**
 * company の総合スコア計算
 *
 * ルール:
 * - ユーザの複数 variant に対して最大一致を積み上げる
 * - short_name / name / category / tags を横断的に使う
 * - 固有語がある会社が自然に勝つ
 */
function calculateCompanyScore(company = {}, userVariants = []) {
  const { all, strong, general, weak } = buildCompanyTerms(company);

  let score = 0;
  let strongHitCount = 0;
  let weakHitCount = 0;
  let matchedTerms = [];

  for (const term of all) {
    let best = 0;
    let strength = "general";

    if (strong.includes(term)) {
      strength = "strong";
    } else if (weak.includes(term)) {
      strength = "weak";
    } else if (general.includes(term)) {
      strength = "general";
    }

    for (const variant of userVariants) {
      const s = scoreTermAgainstVariant(term, variant, strength);
      if (s > best) {
        best = s;
      }
    }

    if (best <= 0) {
      continue;
    }

    score += best;
    matchedTerms.push(term);

    const isWeakGlobal =
      WEAK_GENERIC_WORDS.has(term) || WEAK_GENERIC_WORDS.has(normalizeForMatch(term));

    if (strength === "weak" || isWeakGlobal) {
      weakHitCount += 1;
    } else {
      strongHitCount += 1;
    }
  }

  /**
   * 会社名 / 短縮名に当たった場合は少し厚め
   */
  const shortName = String(company.short_name || "").trim();
  const name = String(company.name || "").trim();

  for (const variant of userVariants) {
    if (shortName && scoreTermAgainstVariant(shortName, variant, "strong") >= 8) {
      score += 3;
      break;
    }
  }

  for (const variant of userVariants) {
    if (name && scoreTermAgainstVariant(name, variant, "strong") >= 8) {
      score += 2;
      break;
    }
  }

  /**
   * 弱語だけなら誤爆防止で圧縮
   */
  if (strongHitCount === 0 && weakHitCount > 0) {
    score = Math.min(score, 2);
  }

  return {
    score,
    strongHitCount,
    weakHitCount,
    matchedTerms: Array.from(new Set(matchedTerms)),
  };
}

/**
 * AI候補抽出
 *
 * 目的:
 * - Sheet主導で companyCandidates を作る
 * - 会社個別ベタ書きを避ける
 * - 長く使える scoring にする
 */
async function findCompaniesForAi(userMessage = "") {
  const companyMaster = await getAllCompaniesFromSheet();
  const userVariants = expandUserVariants(userMessage);

  if (!userVariants.length) {
    return [];
  }

  const results = [];

  for (const c of companyMaster) {
    if (!isTrue(c.show_in_ai)) {
      continue;
    }

    const scored = calculateCompanyScore(c, userVariants);

    /**
     * 採用条件
     * - strongHit が1つ以上
     * - または score が十分ある
     */
    const shouldInclude = scored.strongHitCount >= 1 || scored.score >= 6;

    if (!shouldInclude) {
      continue;
    }

    results.push({
      ...c,
      tags: parseTags(c.tags),
      show_in_ai: isTrue(c.show_in_ai),
      show_in_html: isTrue(c.show_in_html),
      sort_order: Number(c.sort_order || 9999),
      priority: Number(c.priority || 0),
      score: scored.score,
      strongHitCount: scored.strongHitCount,
      weakHitCount: scored.weakHitCount,
      matchedTerms: scored.matchedTerms,
    });
  }

  /**
   * 並び順
   * 1. score 高い順
   * 2. strongHitCount 高い順
   * 3. priority 高い順
   * 4. sort_order 小さい順
   */
  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    if (b.strongHitCount !== a.strongHitCount) {
      return b.strongHitCount - a.strongHitCount;
    }

    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }

    return a.sort_order - b.sort_order;
  });

  return results;
}

module.exports = {
  getCompaniesForList,
  getCompanyById,
  findCompaniesForAi,
};