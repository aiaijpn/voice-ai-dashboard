"use strict";

const {
  findCompaniesForAi,
  getCompaniesForList,
  getCompanyById,
} = require("../services/companyService");

console.log("---- findCompaniesForAi: スーツ作りたい ----");
console.log(findCompaniesForAi("スーツ作りたい"));

console.log("---- findCompaniesForAi: 相続が気になる ----");
console.log(findCompaniesForAi("相続が気になる"));

console.log("---- getCompanyById: kanai_suit ----");
console.log(getCompanyById("kanai_suit"));

console.log("---- getCompaniesForList ----");
console.log(getCompaniesForList());