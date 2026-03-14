ADR-007: Conversation History Repository Implementation
Status

Accepted
2026-03-14

Context

栄一ツールでは、AIとの会話履歴を永続化し、将来的な分析・未解決Q管理・ユーザ履歴参照などに利用する必要がある。

システムの基本構造は以下である。

LINE Webhook
↓
AI Processing
↓
Conversation Persistence
↓
Google Sheets

これまで会話履歴の永続化レイヤーが未実装であったため、
Conversation Repository を新規実装する。

本ADRでは

Repository層の実装

Google Sheetsへの保存

ローカル単体テスト

までを対象とする。

本番統合（messageService組み込み）は次ADRで扱う。

Decision

Conversation History 保存機構を以下の構造で実装した。

保存フロー
appendConversationRow
↓
appendRowToSheet
↓
Google Sheets API
↓
conversation_history sheet
実装レイヤー
repositories/
  conversationRepository.js

sheet/
  saver.js
使用API

Google Sheets API v4

認証方式

Service Account
環境変数
SPREADSHEET_ID
CONVERSATION_SHEET_NAME
GOOGLE_SERVICE_ACCOUNT_FILE

例

SPREADSHEET_ID=xxxxxxxxxxxxxxxxxxxxxxxx
CONVERSATION_SHEET_NAME=conversation_history
GOOGLE_SERVICE_ACCOUNT_FILE=service-account.json
保存スキーマ

Google Sheets

conversation_history

timestamp
bot_id
user_id
user_message
ai_reply
operator_memo
manual_send
source_type
unresolved_q
Repository API
appendConversationRow()

内部処理

appendRowToSheet()
Google Sheets 書き込み

API

spreadsheets.values.append

設定

range: conversation_history!A1:Z
valueInputOption: USER_ENTERED
Testing

ローカル単体テストを実施。

テストスクリプト

test/testConversationRepository.js

実行

node test/testConversationRepository.js

成功ログ

SUCCESS appendConversationRow

Google Sheets にレコード追加が確認された。

Result

以下が正常動作することを確認。

Service Account authentication
Google Sheets API connection
Repository layer
appendRowToSheet
appendConversationRow
conversation_history persistence

これにより

Conversation Persistence Layer

が完成した。

Scope

ADR007の対象

Conversation Repository 実装
Google Sheets 保存
ローカル単体テスト

対象外

messageService integration
LINE runtime testing
Render production environment

これらは次ADRで扱う。

Next ADR

次の設計

ADR-008
Conversation Persistence Integration

目的

messageService に会話保存処理を組み込む

フロー

LINE
↓
Webhook
↓
AI reply
↓
appendConversationRow
↓
Google Sheets
Notes

本ADRにより、栄一ツールの会話履歴永続化基盤が完成した。

システム構造

LINE
↓
AI
↓
Repository
↓
Google Sheets

この基盤により

会話ログ
未解決Q
ユーザ履歴
分析データ

の拡張が可能となる。

これを

docs/adr/ADR-007-conversation-history-repository.md

として置けば ADRとして綺麗に管理できます。
