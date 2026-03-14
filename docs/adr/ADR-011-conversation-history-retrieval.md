ADR-011

Conversation History Retrieval

Status
Proposed

背景

栄一ツールでは会話履歴保存を段階的に実装している。

現在までの状態

ADR	内容	状態
ADR-007	保存契約統一	完了
ADR-008	conversation_history 保存	完了
ADR-009	admin_message 保存	完了
ADR-010	ai_reply 保存	完了

これにより 会話イベント保存基盤 は完成した。

保存されるイベント

sourceType	意味
user_message	ユーザ発言
admin_message	管理者送信
ai_reply	AI返信
system_event	システム

しかし現在の AI 応答生成では
保存された履歴を AI に渡していない。

そのため

文脈追従

照応（「それ」「なんで？」）

長会話

が成立しない。

AI会話では

履歴 = 世界

であるため
履歴取得機能を追加する必要がある。

決定

AI応答生成前に

conversation_history から履歴を取得し
OpenAI messages に組み込む

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

直近 6 イベント

理由

AIトークン節約

文脈保持に十分

LINE会話平均に適合

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
OpenAI messages 変換

履歴は OpenAI messages へ変換する。

例

[
 { role:"system", content:systemPrompt },

 { role:"user", content:"こんにちは" },
 { role:"assistant", content:"こんにちは。ご相談は？" },

 { role:"user", content:"何の動物？" }
]
実装変更ファイル
種別	ファイル
追加	repositories/conversationRepository.js
追加	services/historyService.js
修正	services/messageService/index.js
repository 追加関数
getConversationHistory(botId, userId, limit)

役割

Google Sheets
conversation_history
から履歴取得

historyService 追加関数
getConversationHistory({
  botId,
  userId,
  limit
})

役割

repository 呼び出し
履歴整形

messageService 変更

OpenAI呼び出し前

履歴取得
↓
messages生成
↓
OpenAI
実装フロー
user_message
↓
履歴取得
↓
systemPrompt + 履歴 + text
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

の順序であり
保存構造に影響を与えない。

期待効果

AI会話能力向上

機能	効果
文脈理解	会話継続
照応理解	「それ」「なんで」対応
会話深掘り	再来促進
顧客理解	AI精度向上
成功確認

Renderログ

conversation history fetch requested
conversation history fetched

AI応答

文脈を踏まえた回答になる
次ADR

ADR-012
Repository整理

目的

外部I/Oの整理

対象

Sheets
DB
API
Queue
現在のAI会話基盤完成度
約 80 %

残り

履歴取得
Repository整理
