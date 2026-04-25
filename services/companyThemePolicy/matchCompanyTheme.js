"use strict";

const { getCompaniesForFixedTheme } = require("../company/companyMasterReader");

function toSafeString(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function normalizeForMatch(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[\s　]+/g, "")
    .replace(/[!！?？。、｡,\-\/\/・／]/g, "")
    .replace(/[ーｰ]/g, "");
}

function scoreTermAgainstMessage(userText, term, weight) {
  const user = normalizeForMatch(userText);
  const candidate = normalizeForMatch(term);

  if (!user || !candidate) {
    return 0;
  }

  if (user === candidate) {
    return weight * 2;
  }

  if (user.includes(candidate) || candidate.includes(user)) {
    return weight;
  }

  return 0;
}

function buildCompanyTerms(company = {}) {
  const terms = [];

  if (company.displayName) {
    terms.push({ value: company.displayName, weight: 18 });
  }

  if (company.shortName) {
    terms.push({ value: company.shortName, weight: 14 });
  }

  if (company.name) {
    terms.push({ value: company.name, weight: 12 });
  }

  if (Array.isArray(company.aliases)) {
    for (const alias of company.aliases) {
      terms.push({ value: alias, weight: 14 });
    }
  }

  if (Array.isArray(company.strongTags)) {
    for (const strongTag of company.strongTags) {
      terms.push({ value: strongTag, weight: 14 });
    }
  }

  if (Array.isArray(company.searchTags)) {
    for (const searchTag of company.searchTags) {
      terms.push({ value: searchTag, weight: 10 });
    }
  }

  if (Array.isArray(company.keywords)) {
    for (const keyword of company.keywords) {
      terms.push({ value: keyword, weight: 10 });
    }
  }

  if (Array.isArray(company.tags)) {
    for (const tag of company.tags) {
      terms.push({ value: tag, weight: 8 });
    }
  }

  return terms.filter((item) => toSafeString(item.value));
}

function scoreCompany(userMessage = "", company = {}) {
  const terms = buildCompanyTerms(company);
  let score = 0;
  const matchedWords = new Set();

  for (const termItem of terms) {
    const matchedScore = scoreTermAgainstMessage(
      userMessage,
      toSafeString(termItem.value),
      Number(termItem.weight || 0)
    );

    if (matchedScore > 0) {
      score += matchedScore;
      matchedWords.add(toSafeString(termItem.value));
    }
  }

  return {
    score,
    matchedWords: Array.from(matchedWords),
  };
}

async function matchCompanyTheme({ userMessage } = {}) {
  const safeUserMessage = toSafeString(userMessage);

  if (!safeUserMessage) {
    return {
      candidates: [],
    };
  }

  const companies = await getCompaniesForFixedTheme();

  const candidates = companies
    .filter((company) => company.showInAi === true)
    .map((company) => {
      const { score, matchedWords } = scoreCompany(safeUserMessage, company);
      return {
        companyId: company.companyId,
        displayName:
          toSafeString(company.displayName) || toSafeString(company.name),
        shortName: toSafeString(company.shortName),
        aliases: Array.isArray(company.aliases) ? company.aliases : [],
        score,
        matchedWords,
      };
    })
    .filter((candidate) => Number(candidate.score || 0) > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.displayName.localeCompare(b.displayName);
    })
    .slice(0, 3);

  return {
    candidates,
  };
}

module.exports = {
  matchCompanyTheme,
};
