ADR-016

AIプロンプト構築責務整理（promptBuilderの明確化）

Status
Proposed

Date
2026-03-15

背景

現在のAI入力構築は以下に分散している。

services/messageService/index.js
services/messageService/promptBuilder.js
services/openaiClient.js

その結果

AI入力構造が読みづらい

プロンプト改善の変更箇所が不明確

デバッグが困難

将来のAI人格拡張が難しい

問題

AI入力構築が複数箇所に存在する。

buildSystemPrompt()
buildOpenAIMessages()
callOpenAI()

AI入力責務が 3ファイルに分散 している。

決定

AI入力構築責務を promptBuilder に完全統一する。

LINE
 ↓
handler
 ↓
processMessage
 ↓
promptBuilder
 ↓
OpenAI
 ↓
responseParser
promptBuilderの責務

promptBuilder は以下を担当する。

systemPrompt 構築

会話履歴統合

OpenAI messages 生成

AI入力ログ出力

新インターフェース
promptBuilder
buildPromptContext({
  rid,
  tone,
  historyItems,
  userText
})
返り値
{
  systemPrompt,
  messages
}
messageServiceの役割

messageService は
promptBuilder を呼び出すのみ とする。

変更前

systemPrompt
↓
buildOpenAIMessages
↓
callOpenAI

変更後

promptBuilder
↓
callOpenAI
修正対象ファイル
services/messageService/index.js
services/messageService/promptBuilder.js
変更規模
項目	規模
修正ファイル	2
削除ファイル	0
追加ファイル	0
変更行数	約40〜80
難易度

低

理由

外部I/O変更なし

OpenAI呼び出し変更なし

履歴構造変更なし

ADR014 / ADR015 により責務分離済み。

実装完了条件

以下が成立する。

messageService にプロンプト構築コードが存在しない

buildSystemPrompt

buildOpenAIMessages

が promptBuilder のみ に存在する。

テスト

LINEで

こんにちは

送信。

ログ確認

OpenAI messages built
historyCount
messageCount

が出力されること。

将来拡張

このADRにより以下が可能になる。

Operator人格注入

AI人格切替

広告人格

セグメント人格
