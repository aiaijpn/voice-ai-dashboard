"use strict";

/**
 * companyService
 *
 * 役割:
 * - companyMaster を参照して企業情報を返す
 * - 一覧表示用の企業配列を返す
 * - AI会話用の候補企業を返す
 * - ID指定で企業を返す
 *
 * 方針:
 * - データの唯一ソースは data/companyMaster.js
 * - 検索ロジックはこの service に集約する
 * - V3では単純一致 + 単純ソートに徹する
 */

const { companyMaster } = require("../data/companyMaster");
const { matchesCompanyTags } = require("../utils/textMatch");

/**
 * 協賛一覧ページ向け
 *
 * - show_in_list=true を返す
 * - sort_order 昇順
 *
 * @returns {Array}
 */
function getCompaniesForList() {
  return companyMaster
    .filter((item) => item.show_in_list)
    .sort((a, b) => {
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
}

/**
 * ID指定で企業1件取得
 *
 * @param {string} id
 * @returns {Object|undefined}
 */
function getCompanyById(id = "") {
  const targetId = String(id || "").trim();

  if (!targetId) {
    return undefined;
  }

  return companyMaster.find((item) => item.id === targetId);
}

/**
 * AI会話向け候補企業取得
 *
 * 条件:
 * - type === "company"
 * - is_active === true
 * - show_in_ai === true
 * - userMessage と tags が一致
 *
 * 並び順:
 * 1. priority 降順
 * 2. sort_order 昇順
 *
 * @param {string} userMessage
 * @returns {Array}
 */
function findCompaniesForAi(userMessage = "") {
  return companyMaster
    .filter((item) => {
      return (
        item.type === "company" &&
        item.is_active === true &&
        item.show_in_ai === true &&
        matchesCompanyTags(userMessage, item.tags)
      );
    })
    .sort((a, b) => {
      const priorityA = Number(a.priority || 0);
      const priorityB = Number(b.priority || 0);

      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }

      return Number(a.sort_order || 0) - Number(b.sort_order || 0);
    });
}

module.exports = {
  getCompaniesForList,
  getCompanyById,
  findCompaniesForAi,
};