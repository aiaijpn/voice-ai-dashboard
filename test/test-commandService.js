"use strict";

/**
 * コマンド機能の動作確認テスト
 * 最小限の疎通確認
 */

const { parseCommand } = require("../services/commandService/parseCommand");
const commandStateRepository = require("../repositories/commandStateRepository");
const commandStateService = require("../services/commandStateService");
const { executeCommand } = require("../services/commandService");

async function testParseCommand() {
  console.log("\n=== TEST: parseCommand ===");

  const tests = [
    { input: "V35", expected: "set_engine" },
    { input: "V37", expected: "set_engine" },
    { input: "OFF", expected: "set_engine" },
    { input: "状態", expected: "show_state" },
    { input: "テーマ解除", expected: "clear_theme" },
    { input: "テーマ 金井", expected: "set_theme" },
    { input: "テーマ　池田", expected: "set_theme" },
    { input: "普通のテキスト", expected: null },
    { input: "", expected: null },
  ];

  for (const test of tests) {
    const result = parseCommand(test.input);
    const resultType = result?.type || null;
    const pass = resultType === test.expected;
    console.log(
      `${pass ? "✅" : "❌"} input="${test.input}" → type=${resultType}`
    );
  }
}

async function testCommandStateRepository() {
  console.log("\n=== TEST: commandStateRepository ===");

  try {
    // 保存テスト
    const saveResult = await commandStateRepository.saveState({
      botId: "test-bot",
      userId: "test-user",
      patch: {
        currentEngine: "v37",
        currentTheme: "kanai_suit",
      },
    });

    console.log(`✅ saveState success:`, saveResult?.success);

    // 取得テスト
    const getResult = await commandStateRepository.getState({
      botId: "test-bot",
      userId: "test-user",
    });

    console.log(`✅ getState success:`, getResult?.success);
    console.log(`   data:`, getResult?.data);

    // 状態確認
    const isV37 =
      getResult?.data?.currentEngine === "v37" ? "✅" : "❌";
    const isTheme =
      getResult?.data?.currentTheme === "kanai_suit" ? "✅" : "❌";
    console.log(`${isV37} currentEngine === v37`);
    console.log(`${isTheme} currentTheme === kanai_suit`);
  } catch (error) {
    console.log(`❌ Error:`, error?.message);
  }
}

async function testCommandStateService() {
  console.log("\n=== TEST: commandStateService ===");

  try {
    // エンジン設定テスト
    const setEngineResult = await commandStateService.setCurrentEngine({
      botId: "test-bot-2",
      userId: "test-user-2",
      engine: "v35",
    });

    console.log(`✅ setCurrentEngine success:`, setEngineResult?.success);

    // テーマ設定テスト
    const setThemeResult = await commandStateService.setCurrentTheme({
      botId: "test-bot-2",
      userId: "test-user-2",
      companyId: "ikeda_law",
    });

    console.log(`✅ setCurrentTheme success:`, setThemeResult?.success);

    // 状態取得テスト
    const getResult = await commandStateService.getCommandState({
      botId: "test-bot-2",
      userId: "test-user-2",
    });

    console.log(`✅ getCommandState success:`, getResult?.success);
    console.log(`   engine:`, getResult?.data?.currentEngine);
    console.log(`   theme:`, getResult?.data?.currentTheme);
  } catch (error) {
    console.log(`❌ Error:`, error?.message);
  }
}

async function testExecuteCommand() {
  console.log("\n=== TEST: executeCommand ===");

  try {
    // エンジン切り替えテスト
    const switchResult = await executeCommand({
      botId: "test-bot-3",
      userId: "test-user-3",
      text: "V37",
    });

    console.log(`✅ executeCommand(V37) handled:`, switchResult?.data?.handled);
    console.log(`   reply:`, switchResult?.data?.replyText);

    // 状態表示テスト
    const stateResult = await executeCommand({
      botId: "test-bot-3",
      userId: "test-user-3",
      text: "状態",
    });

    console.log(`✅ executeCommand(状態) handled:`, stateResult?.data?.handled);
    console.log(`   reply:`, stateResult?.data?.replyText);

    // テーマ設定テスト
    const themeResult = await executeCommand({
      botId: "test-bot-3",
      userId: "test-user-3",
      text: "テーマ 池田法律",
    });

    console.log(
      `✅ executeCommand(テーマ 池田法律) handled:`,
      themeResult?.data?.handled
    );
    console.log(`   reply:`, themeResult?.data?.replyText);

    // 非コマンドテスト
    const normalResult = await executeCommand({
      botId: "test-bot-3",
      userId: "test-user-3",
      text: "これは普通のテキストです",
    });

    console.log(
      `✅ executeCommand(普通のテキスト) handled:`,
      normalResult?.data?.handled
    );

    // OFF テスト
    const offResult = await executeCommand({
      botId: "test-bot-3",
      userId: "test-user-3",
      text: "OFF",
    });

    console.log(`✅ executeCommand(OFF) handled:`, offResult?.data?.handled);
    console.log(`   reply:`, offResult?.data?.replyText);

    // テーマ解除テスト
    const clearThemeResult = await executeCommand({
      botId: "test-bot-3",
      userId: "test-user-3",
      text: "テーマ解除",
    });

    console.log(`✅ executeCommand(テーマ解除) handled:`, clearThemeResult?.data?.handled);
    console.log(`   reply:`, clearThemeResult?.data?.replyText);

    // 再度状態確認
    const stateAfterClearResult = await executeCommand({
      botId: "test-bot-3",
      userId: "test-user-3",
      text: "状態",
    });

    console.log(`✅ executeCommand(解除後の状態) handled:`, stateAfterClearResult?.data?.handled);
    console.log(`   reply:`, stateAfterClearResult?.data?.replyText);
  } catch (error) {
    console.log(`❌ Error:`, error?.message);
  }
}

async function runAllTests() {
  console.log("🧪 COMMAND FEATURE TEST SUITE");
  console.log("================================");

  await testParseCommand();
  await testCommandStateRepository();
  await testCommandStateService();
  await testExecuteCommand();

  console.log("\n🎉 All tests completed");
}

// 実行
runAllTests().catch(console.error);
