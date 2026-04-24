"use strict";

/**
 * companyIdNormalizer
 *
 * Purpose:
 * - Normalize known legacy / alias company IDs to canonical company IDs
 * - Keep canonical IDs unchanged
 * - Preserve unknown IDs as-is for V3.81 compatibility
 *
 * Out of scope:
 * - resolver / matcher behavior
 * - company inference from user text
 * - company_master dynamic lookup
 */

const COMPANY_ID_ALIAS_MAP = Object.freeze({
  ikeda_legal: "ikeda_law",
  kanai_suits: "kanai_suit",
});

const CANONICAL_COMPANY_IDS = Object.freeze(
  Array.from(
    new Set([
      ...Object.values(COMPANY_ID_ALIAS_MAP),
    ])
  )
);

function toSafeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function getCompanyIdAliases() {
  return { ...COMPANY_ID_ALIAS_MAP };
}

function normalizeCompanyId(companyId = "") {
  const safeCompanyId = toSafeString(companyId);

  if (!safeCompanyId) {
    return safeCompanyId;
  }

  return COMPANY_ID_ALIAS_MAP[safeCompanyId] || safeCompanyId;
}

function isCanonicalCompanyId(companyId = "") {
  const safeCompanyId = toSafeString(companyId);

  if (!safeCompanyId) {
    return false;
  }

  return CANONICAL_COMPANY_IDS.includes(safeCompanyId);
}

module.exports = {
  normalizeCompanyId,
  isCanonicalCompanyId,
  getCompanyIdAliases,
};
