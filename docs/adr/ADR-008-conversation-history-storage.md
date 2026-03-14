# ADR-008
Conversation History Storage Implementation

## Status

Accepted  
2026-03-14

---

## Context

栄一ツールでは、LINE Webhook を起点として  
ユーザメッセージと AI 応答が生成される。

これまでは

- voiceログ（お客様の声）
- usageログ

のみが保存されており、

**AI会話履歴そのものの保存機構が存在しなかった。**

その結果、以下の問題が発生する。

1. AIが過去会話を参照できない
2. 未解決質問（unresolvedQ）の蓄積ができない
3. Operator分析ができない
4. 将来のAI改善データが残らない

したがって

**Conversation History を独立したリポジトリとして保存する仕組みを導入する。**

---

## Decision

会話履歴保存は以下の構造で実装する。

### 保存構造


LINE Webhook
↓
handler.js
↓
messageService
↓
historyService
↓
conversationRepository
↓
sheet/saver
↓
Google Sheets


---

### 保存先シート


conversation_history


---

### 保存カラム

| column | description |
|------|-------------|
| timestamp | 保存時刻 |
| bot_id | bot識別子 |
| user_id | LINEユーザID |
| user_message | ユーザ発言 |
| ai_reply | AI応答 |
| operator_memo | 管理者メモ |
| manual_send | 手動送信フラグ |
| source_type | message / broadcast 等 |
| unresolved_q | 未解決質問 |

---

### Service 層


services/historyService.js


責務

- 保存データの正規化
- 入力検証
- repository呼び出し

---

### Repository 層


repositories/conversationRepository.js


責務

- Google Sheets 保存処理
- appendRowToSheet 呼び出し

---

### Storage 層


sheet/saver.js


責務

- Sheets API 呼び出し
- appendRow 実行

---

## Consequences

### メリット

1. AIが会話履歴を参照可能
2. 未解決質問資産化
3. Operator分析が可能
4. 将来のAI学習基盤になる
5. 会話トレーサビリティ確保

---

### デメリット

1. Sheets書き込み回数が増加
2. 将来DB移行の可能性

---

## Future

将来的に以下を検討する。

- SQL DB 移行
- conversation index 作成
- unresolvedQ 自動抽出
- Operatorダッシュボード連携

---

## Notes

本ADRは

ADR-007  
Google Sheets 保存契約統一

に依存する。

Sheets接続仕様は  
ADR-007 の契約を使用する。
技術的補足（重要）

ADR構造として見ると

ADR007
   ↓
ADR008

つまり

007 = 外部保存契約
008 = 会話履歴機能

です。
