# ADR-009 管理者メッセージ送信（Admin Message Send）

## Status

Accepted

## Date

2026-03-14

---

## Context

栄一ツールでは AI 会話履歴を  
`conversation_history` として保存する基盤（ADR-008）が整備された。

しかし、Operator Panel（管理者パネル）から送信されるメッセージは  
現在 LINE へ送信されるのみで、会話履歴には保存されていない。

この状態では次の問題が発生する。

1. 管理者が送信した内容を AI が知らない
2. その後のユーザ発言との文脈が壊れる
3. 会話履歴を後から見ても人間介入が再現できない
4. 営業メッセージの効果分析ができない

AI 会話システムでは **履歴が世界である** ため、  
管理者送信メッセージも会話イベントとして扱う必要がある。

---

## Decision

Operator Panel から送信されたメッセージを  
`conversation_history` に保存する。

保存時の `sourceType` は以下とする。


admin_message


会話履歴は以下のイベントで構成される。

- user_message
- ai_reply
- admin_message
- system_event

管理者メッセージ送信の処理フローは次とする。


Operator Panel
↓
Admin Message Send
↓
LINE Messaging API
↓
送信成功
↓
conversation_history 保存


送信失敗時は履歴保存を行わない。

---

## Scope

本 ADR は以下を対象とする。

- Operator Panel からの管理者メッセージ送信
- 会話履歴への admin_message 追加
- AI 会話との整合維持

対象外：

- セグメント配信機能
- 高度なマーケティング配信
- 配信分析ダッシュボード
- 配信テンプレート管理

---

## Data Structure

保存データは ADR-008 の契約を踏襲する。


{
botId: "example_bot",
userId: "Uxxxxxxxx",
timestamp: 1710000000000,
sourceType: "admin_message",
userMessage: "",
aiReply: "本日キャンセル席があります",
operatorMemo: "operator panel send",
manualSend: true,
unresolvedQ: false
}


運用ルール：

- `sourceType = admin_message`
- `aiReply` に送信本文を保存
- `userMessage` は空文字
- `manualSend = true`

既存データ契約との互換性を優先する。

---

## Implementation Policy

管理者メッセージ送信は専用サービスを通して実行する。


server.js
↓
adminMessageService
↓
historyService
↓
conversationRepository


基本ルール：

- LINE送信成功時のみ履歴保存
- `sheet/saver` を直接呼ばない
- `historyService` 経由で保存する

---

## Target Files

本 ADR の実装対象ファイル：


docs/adr/ADR-009-admin-message-send.md
services/adminMessageService.js
server.js
services/historyService.js
repositories/conversationRepository.js


新規追加：


services/adminMessageService.js


---

## Consequences

Positive:

- AI 会話の整合性が向上する
- 人間介入が履歴として残る
- 会話の完全再現が可能
- 営業メッセージの効果分析が可能

Negative:

- 履歴行数が増加する
- 同一メッセージが複数ユーザに保存される可能性

しかし、現在のユーザ規模（100人程度）では  
運用上問題ないと判断する。

---

## Future Extensions

将来的に以下を拡張可能とする。

- セグメント送信
- 管理者送信テンプレート
- AI による送信提案
- 配信効果分析
- Operator支援AI

---

## Related ADR

- ADR-001 Service返り値契約統一
- ADR-002 messageService分割
- ADR-003 LINE送信エンジン統一
- ADR-007 保存契約統一
- ADR-008 Conversation History Storage
ADR009 の対象ファイル（整理）
docs/adr/ADR-009-admin-message-send.md
services/adminMessageService.js   ← 新規
server.js
services/historyService.js
repositories/conversationRepository.js
次ステップ（実装）

ADR009は コード変更量がかなり少ない です。

実際の実装は

約40行

程度で終わります。
