ADR-010 AI Reply History 保存

(AI Conversation Continuity)

Status

Accepted

Date

2026-03-14

背景

現在の栄一ツールでは
以下のイベントが conversation_history に保存されている。

イベント	sourceType
ユーザメッセージ	line_webhook_text
管理者送信	admin_message

しかし AI返信自体は履歴に保存されていない。

そのため AIは

過去の自分の返信

会話の文脈

を参照できない。

これは 会話AIの品質を著しく下げる要因になる。

AI会話システムでは

履歴 = 世界

である。

従って AI返信も履歴として保存する必要がある。

決定

AI返信を conversation_history に保存する。

新しい履歴イベント種別として

ai_reply

を正式採用する。

履歴イベント一覧（更新）

conversation_history は次の4種を扱う。

sourceType	説明
user_message	ユーザ発言
ai_reply	AI返信
admin_message	管理者送信
system_event	システムイベント
保存形式

AI返信保存時のデータ構造

{
  "botId": "voice-ai-dash",
  "userId": "Uxxxxxxxxxxxx",
  "timestamp": 1710000000000,
  "sourceType": "ai_reply",
  "userMessage": "",
  "aiReply": "AIの返信本文",
  "operatorMemo": "",
  "manualSend": false,
  "unresolvedQ": false
}
保存ルール
フィールド	値
sourceType	ai_reply
userMessage	空文字
aiReply	AI返信本文
manualSend	false
operatorMemo	空
unresolvedQ	false
実装位置

AI返信生成後に保存する。

LINE webhook
↓
handler
↓
messageService
↓
AI生成
↓
historyService.saveConversationHistory
↓
conversationRepository
↓
Google Sheets
実装コード（例）
await saveConversationHistory({
  botId,
  userId,
  sourceType: "ai_reply",
  aiReply: replyText
});
影響
正の影響

AIが

自分の返信

会話の流れ

を履歴として保持できる。

結果として

会話継続性

文脈理解

再質問対応

が大幅に改善される。

負の影響

履歴保存量が増える。

しかし現在の想定規模

100ユーザ

では問題にならない。

将来拡張

この ADR により次の機能が可能になる。

AI会話引継ぎ

顧客会話分析

セグメントAI

売上会話解析

RII分析

関連ADR
ADR	内容
ADR-007	保存契約統一
ADR-008	Conversation History Storage
ADR-009	Admin Message History
次のADR

AI会話引継ぎを完全に実現するためには
履歴保存だけでは不十分である。

AI生成時に 過去履歴を取得する機能 が必要となる。

そのため次の ADR を予定する。

ADR-011
Conversation History Load
ADR010 の役割

この ADR は

AI会話履歴保存

を定義する。

AI会話引継ぎは

ADR010 保存
ADR011 取得

の 2段構成で完成する。

ADR010 の設計思想

栄一ツールは

契約
↓
構造
↓
実装

の順で設計する。

AI返信保存を契約として固定することで

DB移行

履歴分析

AI会話強化

を安全に行える。

実装規模

実装差分

約10行
結論

AI返信履歴を保存することで

会話AI
→
会話記憶AI

へ進化する。

これは栄一ツールの中核機能である。

もし希望があれば、次に 開発的にかなり重要な話をします。

実は ADR010 を入れると
ADR011 の設計がほぼ自動的に決まります。

そしてここから

AI会話レベル
10倍

になります。
