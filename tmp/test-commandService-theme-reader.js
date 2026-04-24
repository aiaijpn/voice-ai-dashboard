"use strict";

const assert = require("assert");
const path = require("path");

function loadCommandServiceWithReaderMock(readerMock) {
  const readerPath = require.resolve("../services/company/companyMasterReader");
  const commandServicePath = require.resolve("../services/commandService/index");

  delete require.cache[readerPath];
  delete require.cache[commandServicePath];

  require.cache[readerPath] = {
    id: readerPath,
    filename: readerPath,
    loaded: true,
    exports: readerMock,
  };

  return require(commandServicePath);
}

async function testReaderBackedThemeResolution() {
  const commandService = loadCommandServiceWithReaderMock({
    async getCompaniesForFixedTheme() {
      return [
        {
          companyId: "kanai_suit",
          displayName: "オーダースーツ金井",
          shortName: "金井",
          name: "オーダースーツ金井",
          aliases: [],
        },
        {
          companyId: "ikeda_law",
          displayName: "池田法律相談",
          shortName: "池田",
          name: "池田法律相談",
          aliases: [],
        },
      ];
    },
    async getCompanyById(companyId) {
      const map = {
        kanai_suit: {
          companyId: "kanai_suit",
          displayName: "オーダースーツ金井",
        },
        ikeda_law: {
          companyId: "ikeda_law",
          displayName: "池田法律相談",
        },
      };

      return map[companyId] || null;
    },
  });

  const kanai = await commandService.resolveThemeNameToCompanyId("金井");
  const ikeda = await commandService.resolveThemeNameToCompanyId("池田");

  assert.strictEqual(kanai, "kanai_suit");
  assert.strictEqual(ikeda, "ikeda_law");

  const stateReply = await commandService.buildStateReply({
    currentEngine: "v381",
    currentTheme: "kanai_suit",
  });
  assert.ok(stateReply.includes("V381"));
  assert.ok(stateReply.includes("オーダースーツ金井"));

  const showThemeReply = await commandService.buildShowThemeReply({
    currentTheme: "ikeda_law",
  });
  assert.strictEqual(showThemeReply, "現在のテーマ固定: 池田法律相談");

  const themeListReply = await commandService.buildThemeListReply();
  assert.ok(themeListReply.includes("オーダースーツ金井"));
  assert.ok(themeListReply.includes("池田法律相談"));

  const setThemeResult = await commandService.executeCommand({
    botId: "bot-theme-test",
    userId: "user-theme-test",
    text: "＊固定 金井",
  });
  assert.strictEqual(setThemeResult.success, true);
  assert.strictEqual(setThemeResult.data.handled, true);
  assert.ok(setThemeResult.data.replyText.includes("オーダースーツ金井"));

  const stateResult = await commandService.executeCommand({
    botId: "bot-theme-test",
    userId: "user-theme-test",
    text: "＊状態",
  });
  assert.strictEqual(stateResult.success, true);
  assert.strictEqual(stateResult.data.handled, true);
  assert.ok(stateResult.data.replyText.includes("オーダースーツ金井"));

  const clearThemeResult = await commandService.executeCommand({
    botId: "bot-theme-test",
    userId: "user-theme-test",
    text: "＊解除する",
  });
  assert.strictEqual(clearThemeResult.success, true);
  assert.strictEqual(clearThemeResult.data.handled, true);

  const stateAfterClearResult = await commandService.executeCommand({
    botId: "bot-theme-test",
    userId: "user-theme-test",
    text: "＊状態",
  });
  assert.strictEqual(stateAfterClearResult.success, true);
  assert.ok(stateAfterClearResult.data.replyText.includes("なし"));
}

async function testFallbackWhenReaderFails() {
  const commandService = loadCommandServiceWithReaderMock({
    async getCompaniesForFixedTheme() {
      throw new Error("reader unavailable");
    },
    async getCompanyById() {
      throw new Error("reader unavailable");
    },
  });

  const kanai = await commandService.resolveThemeNameToCompanyId("金井");
  const ikeda = await commandService.resolveThemeNameToCompanyId("池田");

  assert.strictEqual(kanai, "kanai_suit");
  assert.strictEqual(ikeda, "ikeda_law");

  const stateReply = await commandService.buildStateReply({
    currentEngine: "v381",
    currentTheme: "kanai_suit",
  });
  assert.ok(stateReply.includes("オーダースーツ金井"));
}

async function main() {
  await testReaderBackedThemeResolution();
  await testFallbackWhenReaderFails();
  console.log("PASS test-commandService-theme-reader");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
