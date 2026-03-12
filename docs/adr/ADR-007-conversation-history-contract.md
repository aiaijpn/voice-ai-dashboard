ADR-007

会話履歴保存契約拡張

Status

Proposed

Context（背景）

栄一ツールでは現在、

LINEユーザー
   ↓
Webhook
   ↓
handler
   ↓
messageService
   ↓
AI返信

という構造で会話が処理されている。

しかし現在のログ保存は

usageログ

voiceログ

のみであり、

会話の構造的保存が存在しない。

そのため次の機能実装が困難になる。

将来必要になる機能

未解決質問管理

Operatorメモ

手動返信ログ

AI履歴学習

LIFF画面表示

会話検索

セグメント分析

つまり

会話履歴を「契約化」する必要がある。

Decision（決定）

会話履歴保存の 標準データ契約 を定義する。

保存構造を以下に統一する。

conversationLog

保存フィールド

{
  botId: string,
  userId: string,
  timestamp: number,

  userMessage: string,
  aiReply: string | null,

  operatorMemo: string | null,
  manualSend: boolean,

  sourceType: string,

  unresolvedQ: boolean
}
フィールド説明
フィールド	説明
botId	LINE Bot識別
userId	LINE userId
timestamp	保存時刻
userMessage	ユーザー発言
aiReply	AI返信
operatorMemo	オペレーター内部メモ
manualSend	手動返信フラグ
sourceType	メッセージ発生源
unresolvedQ	未解決質問
sourceType 定義
user_message
ai_reply
operator_reply
scheduler
liff
control_panel

将来拡張可能。

保存タイミング

保存は Service層で行う。

handler
   ↓
messageService
   ↓
conversationRepository.save()

handlerでは保存しない。

理由

handlerは契約層

保存は業務ロジック

保存レイヤ構造
handler
   ↓
service
   ↓
repository
   ↓
storage

例

services/historyService.js
repositories/conversationRepository.js
初期ストレージ

第一次デモでは

Google Sheets

を使用。

将来

SQL
PostgreSQL
BigQuery

へ移行可能。

契約を固定することで

保存先変更の影響を遮断する。

例

保存データ例

{
  botId: "avatar_eiichi",
  userId: "U12345",
  timestamp: 1710000000,

  userMessage: "AIって何？",
  aiReply: "AIは人工知能です。",

  operatorMemo: null,
  manualSend: false,

  sourceType: "user_message",

  unresolvedQ: false
}
期待効果
1 会話資産化

ユーザー会話が

データ資産

になる。

2 AI改善

AIは過去履歴を参照できる。

3 未解決Q管理
unresolvedQ = true

で管理。

4 分析基盤

将来

classifier
RII
segment

へ連携可能。

Consequences（影響）

追加モジュール

services/historyService.js
repositories/conversationRepository.js

messageService から呼び出す。

非対象

次は ADR007の対象外

classifier

RII分析

セグメント

広告挿入

これらは

ADR-008
ADR-009
ADR-010

で管理する。

Implementation（実装範囲）

最小実装

historyService.saveConversation()

保存項目

botId
userId
timestamp
userMessage
aiReply
sourceType

その他項目は

null
false

で保存。

Related ADR
ADR-001 返り値契約
ADR-002 messageService分割
ADR-003 LINE送信統一
ADR-008 classifier拡張
ADR-009 セグメント
結論

ADR-007により

会話履歴が正式な契約データになる。

これにより

AI改善

顧客理解

セグメント

広告最適化

の基盤が成立する。
