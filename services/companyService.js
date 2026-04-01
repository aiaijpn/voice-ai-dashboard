"use strict";

const { getAllCompaniesFromSheet } = require("./companySheetService");
const { matchesCompanyTags } = require("../utils/textMatch");

/**
 * TRUE判定
 */
function isTrue(value) {
  const v = String(value || "").toLowerCase();
  return v === "true" || v === "1";
}

/**
 * 協賛一覧
 *
 * show_in_html が値ありなら表示
 */
async function getCompaniesForList() {
  const companyMaster = await getAllCompaniesFromSheet();

  return companyMaster
    .filter((item) => item.show_in_html !== "")
    .sort((a, b) => Number(a.show_in_html || 0) - Number(b.show_in_html || 0));
}

/**
 * ID取得
 */
async function getCompanyById(id = "") {
  const companyMaster = await getAllCompaniesFromSheet();
  const targetId = String(id || "").trim();

  if (!targetId) return undefined;

  return companyMaster.find((item) => item.company_id === targetId);
}

/**
 * AI候補
 */
async function findCompaniesForAi(userMessage = "") {
  const companyMaster = await getAllCompaniesFromSheet();
  const safeUserMessage = String(userMessage || "").trim();

  return companyMaster
    .filter((item) => {
      if (!isTrue(item.show_in_ai)) {
        return false;
      }

      const name = String(item.name || "");
      const shortName = String(item.short_name || "");
      const tags = String(item.tags || "");

      const tagList = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      return (
        safeUserMessage.includes(name) ||
        safeUserMessage.includes(shortName) ||
        tagList.some((tag) => safeUserMessage.includes(tag))
      );
    })
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

module.exports = {
  getCompaniesForList,
  getCompanyById,
  findCompaniesForAi,
};