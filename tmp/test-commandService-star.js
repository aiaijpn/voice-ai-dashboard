"use strict";

const { parseCommand } = require("../services/commandService/parseCommand");

const cases = [
  ["＊コマンド", { type: "show_command_list" }],
  ["*コマンド", { type: "show_command_list" }],
  ["＊使い方", { type: "show_usage" }],
  ["＊状態", { type: "show_state" }],
  ["＊テーマ", { type: "show_theme" }],
  ["＊テーマ一覧", { type: "show_theme_list" }],
  ["＊エンジン", { type: "show_engine_list" }],
  ["＊V37", { type: "set_engine", engine: "v37" }],
  ["＊V381", { type: "set_engine", engine: "v381" }],
  ["＊通常", { type: "set_engine", engine: "v35" }],
  ["＊解除", { type: "request_clear_theme" }],
  ["＊解除する", { type: "clear_theme" }],
  ["＊固定", { type: "lock_current_theme" }],
  ["＊固定 金井", { type: "set_theme", themeName: "金井" }],
  ["＊テーマ固定 池田", { type: "set_theme", themeName: "池田" }],
  ["＊金井で固定", { type: "set_theme", themeName: "金井" }],
  ["状態", { type: "show_state" }],
  ["V37", { type: "set_engine", engine: "v37" }],
  ["テーマ解除", { type: "clear_theme" }],
  ["テーマ 金井", { type: "set_theme", themeName: "金井" }],
];

let failed = 0;

for (const [input, expected] of cases) {
  const actual = parseCommand(input);
  const pass = JSON.stringify(actual) === JSON.stringify(expected);

  console.log(`${pass ? "PASS" : "FAIL"} input="${input}"`);
  console.log("  actual  :", JSON.stringify(actual));
  console.log("  expected:", JSON.stringify(expected));

  if (!pass) {
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`\n${failed} case(s) failed.`);
  process.exit(1);
}

console.log("\nAll star command cases passed.");
