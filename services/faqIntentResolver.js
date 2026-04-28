"use strict";

const FAQ_INTENT_RULES = [
  {
    faqKey: "parking",
    terms: [
      "駐車場",
      "駐車",
      "パーキング",
      "車停め",
      "車止め",
      "車を停め",
      "車とめ",
      "停められる",
      "止められる",
    ],
  },
  {
    faqKey: "reservation",
    terms: ["予約", "要予約", "事前予約", "空き", "当日"],
  },
  {
    faqKey: "hours",
    terms: ["営業時間", "何時", "開店", "閉店", "定休日", "休み"],
  },
  {
    faqKey: "price",
    terms: ["料金", "値段", "価格", "いくら", "費用"],
  },
  {
    faqKey: "location",
    terms: ["場所", "住所", "どこ", "アクセス", "行き方", "地図"],
  },
  {
    faqKey: "payment",
    terms: ["支払い", "支払", "カード", "クレカ", "現金", "qr", "paypay"],
  },
];

function normalizeText(text = "") {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[？?]/g, "")
    .replace(/\s+/g, "");
}

function resolveFaqIntent(text = "") {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return {
      matched: false,
      faqKey: "",
      confidence: "none",
      matchedTerms: [],
    };
  }

  for (const rule of FAQ_INTENT_RULES) {
    const matchedTerms = rule.terms.filter((term) => {
      const normalizedTerm = normalizeText(term);
      return normalizedTerm && normalizedText.includes(normalizedTerm);
    });

    if (matchedTerms.length > 0) {
      return {
        matched: true,
        faqKey: rule.faqKey,
        confidence: "rule",
        matchedTerms,
      };
    }
  }

  return {
    matched: false,
    faqKey: "",
    confidence: "none",
    matchedTerms: [],
  };
}

module.exports = {
  FAQ_INTENT_RULES,
  normalizeText,
  resolveFaqIntent,
};
