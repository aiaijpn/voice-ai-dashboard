ADR-011
Conversation History Retrieval

Status
Proposed

背景

栄一ツールでは、会話イベントの保存を段階的に実装してきた。

現在までの状態

ADR	内容	状態
ADR-007	保存契約統一	完了
ADR-008	conversation_history 保存	完了
ADR-009	admin_message 保存	完了
ADR-010	ai_reply 保存	完了

これにより 会話イベント保存基盤 は完成した。

保存されるイベントは以下である。

sourceType	意味
user_message	ユーザ発言
admin_message	管理者送信
ai_reply	AI返信
system_event	システムイベント

しかし現在の AI 応答生成では、保存された履歴を AI に渡していない。

そのため次の問題が発生する。

文脈追従ができない

照応（「それ」「なんで？」）が理解できない

長会話が成立しない

AI会話において

履歴 = 世界

であるため、履歴取得機能を追加する必要がある。

決定

AI応答生成前に

conversation_history

から履歴を取得し、

OpenAI messages

へ組み込む。

対象アーキテクチャ
LINE
 ↓
Webhook
 ↓
handler
 ↓
messageService
 ↓
historyService
 ↓
conversationRepository
 ↓
Google Sheets
履歴取得仕様
取得条件
botId
userId
取得件数

初期実装では

直近 6 イベント

を取得する。

理由

AIトークン節約

文脈保持に十分

LINE会話平均に適合

将来的にはトークン状況や会話品質に応じて
取得件数を調整可能とする。

取得データ形式
[
  {
    sourceType: "user_message",
    userMessage: "質問内容"
  },
  {
    sourceType: "ai_reply",
    aiReply: "AI回答"
  }
]

OpenAI messages へ変換する対象は
初期実装では user_message / ai_reply とする。

admin_message と system_event は
AI会話文脈には通常不要なため除外する。

OpenAI messages 変換

履歴は OpenAI messages 形式へ変換する。

例

[
  { role: "system", content: systemPrompt },

  { role: "user", content: "こんにちは" },
  { role: "assistant", content: "こんにちは。ご相談は？" },

  { role: "user", content: "何の動物？" }
]
実装変更ファイル
種別	ファイル
追加	repositories/conversationRepository.js
追加	services/historyService.js
修正	services/messageService/index.js
conversationRepository

追加関数

getConversationHistory(botId, userId, limit)

役割

Google Sheets conversation_history から履歴取得。

historyService

追加関数

getConversationHistory({
  botId,
  userId,
  limit
})

役割

repository 呼び出し

履歴整形

sourceType フィルタリング

OpenAI messages 変換用データ生成

messageService 変更

OpenAI 呼び出し前に履歴取得を追加する。

処理順

履歴取得
↓
messages生成
↓
OpenAI呼び出し
実装フロー
user_message
 ↓
履歴取得
 ↓
systemPrompt + 履歴 + userText
 ↓
OpenAI
 ↓
ai_reply生成
 ↓
履歴保存
ADR整合性

ADR011は

保存
↓
保存
↓
保存
↓
取得

の順序であり、

既存保存構造

ADR-007

ADR-008

ADR-009

ADR-010

に影響を与えない。

期待効果

AI会話能力が向上する。

機能	効果
文脈理解	会話継続
照応理解	「それ」「なんで」対応
会話深掘り	再来促進
顧客理解	AI精度向上
成功確認
技術確認

Renderログ

conversation history fetch requested
conversation history fetched

が出力されること。

botId / userId 単位で
履歴が正しく取得されること。

履歴0件でもエラーにならないこと。

会話確認

AI応答が

直前文脈を踏まえる

省略表現を理解する

会話が自然に継続する

ことを確認する。

関連ADR
ADR	内容
ADR-007	保存契約統一
ADR-008	conversation_history 保存
ADR-009	admin_message 保存
ADR-010	ai_reply 保存
ADR-012	Repository整理
現在のAI会話基盤完成度

約 80%

残作業

履歴取得安定化

Repository整理

AI入力構造整理

備考

AI会話において履歴は単なるログではなく、

AIの世界モデル

である。

履歴取得の導入により
会話の連続性と理解能力が大幅に向上する。
