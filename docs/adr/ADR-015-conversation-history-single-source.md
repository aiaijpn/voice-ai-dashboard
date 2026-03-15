ADR-015

会話履歴管理の単一化（historyStore廃止）

Status
Proposed

Date
2026-03-15

背景

現在の会話履歴は 2つの仕組み で管理されている。

① メモリ履歴
line/historyStore.js

handler.js 内で管理される。

② 永続履歴
conversation_history
Google Sheets
historyService

で保存・取得される。

現在の処理構造

LINE
 ↓
handler
 ↓
historyStore（履歴A）
 ↓
textForAI

messageService
 ↓
conversation_history（履歴B）
 ↓
OpenAI

この構造では

履歴A

履歴B

の 二重履歴 が AI入力に混入する可能性がある。

結果として

「再度同じ質問ですね」

「繰り返し質問」

などの 誤判定 が発生する。

また履歴管理が二重化しているため

データ整合性低下

デバッグ困難

AI品質低下

の原因となる。

問題

履歴管理の責務が分散している。

handler
messageService

両方が履歴を扱っている。

これは 単一責務原則（Single Responsibility Principle） に反する。

決定

会話履歴の 単一情報源（Single Source of Truth） を

conversation_history

とする。

そのため

historyStore

を 廃止 する。

履歴取得は

historyService.getConversationHistory

に統一する。

新構造
LINE
 ↓
handler
 ↓
processMessage
 ↓
historyService
 ↓
conversation_history
 ↓
OpenAI

履歴管理は

messageService

のみが担当する。

handler の責務

handler は以下のみを担当する。

LINEイベント受信

processMessage 呼び出し

LINE返信

エラーハンドリング

ログ出力

履歴処理は行わない。

削除対象
line/historyStore.js

および

handler.js 内 historyStore 関連コード
削除コード
require("./historyStore")
getHistory
appendMessage
historyKey
buildTextWithHistory
修正対象ファイル
修正
line/handler.js

削除

historyStore

buildTextWithHistory

履歴append

履歴get

削除
line/historyStore.js
変更規模
項目	内容
修正ファイル	1
削除ファイル	1
変更行数	約50〜80行
難易度	低
事故率	低
ADR依存
ADR-007
保存契約

ADR-008
conversation_history 保存

ADR-011
履歴取得

ADR-014
保存データとAI入力分離

ADR-015 はこれらの 整理ADR である。

効果
データ整合性

履歴が 1系統 になる。

AI品質向上

履歴重複による

同一質問誤判定

文脈混線

を防止できる。

コード簡略化
handler.js

が約 30%簡略化 される。

デバッグ容易化

履歴の保存・取得場所が

conversation_history

のみになる。

Acceptance Criteria

以下を満たすこと。

handler.js に履歴処理が存在しない

historyStore.js が削除されている

AI履歴取得は historyService のみ使用

同一ユーザー連続会話で履歴重複が発生しない

テスト

LINE入力

もしも空が無かったら？

期待結果

conversation_history

User: もしも空が無かったら？
AI: ...

履歴重複が発生しない。

次ADR（推奨）
ADR-016
AIプロンプト構築責務整理
promptBuilder

を導入し

AI入力生成を

messageService

へ完全移管する。

ADRロードマップ
ADR-014
保存データとAI入力分離
   ↓
ADR-015
履歴管理単一化
   ↓
ADR-016
AIプロンプト構築整理
補足

履歴が二重になると AIは

同一質問

繰り返し質問

と誤認する。

そのため 履歴の単一化はAI品質維持に重要である。
