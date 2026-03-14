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


//

Unit Test Plan

本ADRに基づく実装では、実装前に 単体テスト観点 を明確化する。
目的は、会話履歴保存機能を 責務単位で安全に検証可能 にすることである。

テスト対象

services/historyService.js

repositories/conversationRepository.js

sheet/saver.js

services/messageService.js

テスト方針

単体テストは以下の責務単位で実施する。

Service層

入力正規化

必須項目検証

Repository呼び出し

返り値契約確認

Repository層

保存用配列の列順固定

保存先シート名固定

saver呼び出し確認

Storage層

Sheets API呼び出し引数確認

環境変数依存確認

例外処理確認

呼び出し元

AI応答生成後に historyService が適切に呼ばれること

履歴保存失敗時の主処理影響確認

前提ルール

単体テストにおける保存契約前提は以下とする。

sourceType 未指定時は "message" に正規化する

operatorMemo 未指定時は "" に正規化する

manualSend 未指定時は false に正規化する

unresolvedQ 未指定時は false に正規化する

botId と userId は必須とする

timestamp は保存時点で確定した値を使用する

Repository は conversation_history シートへ固定保存する

カラム順は ADR-008 で定義した順序を厳守する

historyService 単体テストケース
No	テストケース	入力条件	期待結果
HS-01	正常系（最小入力）	必須項目のみ	success=true で保存処理へ進む
HS-02	正常系（全項目入力）	全項目あり	success=true
HS-03	operatorMemo 未指定	undefined	"" に正規化される
HS-04	manualSend 未指定	undefined	false に正規化される
HS-05	sourceType 未指定	undefined	"message" に正規化される
HS-06	unresolvedQ 未指定	undefined	false に正規化される
HS-07	botId 欠落	botId なし	fail を返す
HS-08	userId 欠落	userId なし	fail を返す
HS-09	Repository失敗	repository が fail を返す	fail を返す
HS-10	Repository例外	repository が throw	fail を返す
conversationRepository 単体テストケース
No	テストケース	入力条件	期待結果
CR-01	正常系	正常データ	conversation_history へ保存処理実行
CR-02	カラム順確認	全項目あり	ADR-008定義順で values 配列生成
CR-03	空文字項目確認	operatorMemo=""	空文字のまま保存配列化
CR-04	boolean項目確認	manualSend=true, unresolvedQ=false	想定どおり values 化
CR-05	saver失敗	appendRowToSheet が fail	fail を返す
CR-06	saver例外	appendRowToSheet が throw	fail を返す
sheet/saver 単体テストケース
No	テストケース	入力条件	期待結果
SV-01	正常系	spreadsheetId, sheetName, values 正常	append 実行成功
SV-02	spreadsheetId 欠落	空または未設定	fail または明示エラー
SV-03	sheetName 欠落	空または未設定	fail または明示エラー
SV-04	values 不正	配列でない	fail または明示エラー
SV-05	Google API例外	API層で throw	fail を返す
SV-06	GOOGLE_SERVICE_ACCOUNT_JSON 不正	JSON不正	明示エラーを返す
messageService 単体テストケース
No	テストケース	入力条件	期待結果
MS-01	AI返信成功 + 履歴保存成功	正常入力	主処理 success
MS-02	AI返信成功 + 履歴保存失敗	history保存のみ失敗	主処理継続、保存失敗はログ化
MS-03	sourceType 伝搬確認	通常メッセージ	"message" が historyService に渡る
MS-04	botId / userId 伝搬確認	通常メッセージ	正しい値が渡る
MS-05	AI返信確定後保存確認	AI応答確定済み	aiReply を含めて保存呼び出しされる
重点確認項目

本ADRにおける単体テストの重点確認項目は以下とする。

列順が壊れないこと

入力正規化が一貫していること

必須項目不足時に早期 fail すること

外部保存失敗時に異常が明確化されること

会話履歴保存失敗が主処理全体を不必要に停止させないこと

テストレベル補足

本ADRで定義する単体テストは、原則として 外部I/Oを mock 化 して実施する。
Google Sheets 実書き込み確認は単体テストではなく、別途 疎通確認 / 手動確認 として扱う。

結論

本機能は

正規化

検証

保存配列生成

外部保存呼び出し

の各責務を分離しているため、
単体テスト可能な構造を持つ。

したがって ADR-008 の実装は、
責務単位で壊れないことを先に保証してから結合確認へ進む 方針を採用する。





Integration Test Plan

本ADRに基づく実装では、単体テスト完了後に 結合テスト を実施する。
目的は、各責務単位で検証済みのモジュールが、実際の呼び出し連鎖の中で 契約どおり接続されること を確認することである。

テスト対象フロー

本ADRの結合対象は以下の保存経路とする。

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
テスト方針

結合テストでは、以下を確認対象とする。

呼び出し順が正しいこと

上位層から下位層へ必要情報が欠落なく渡ること

保存契約どおりに Google Sheets へ保存されること

保存失敗時の挙動が設計どおりであること

主処理（AI応答）が履歴保存に過剰依存しないこと

前提条件

結合テスト実施前に、以下を満たしていることを前提とする。

ADR-007 の保存契約が適用済みである

conversation_history シートが作成済みである

保存カラム順が ADR-008 定義どおりである

.env に必要な環境変数が設定済みである

Google Sheets API 接続が有効である

単体テストで major failure が解消済みである

結合テストケース
No	テストケース	テスト内容	期待結果
IT-01	正常系（通常メッセージ）	LINE から通常メッセージ送信	AI応答成功、conversation_history に1行保存される
IT-02	保存内容確認	保存後にシート確認	各列に正しい値が入る
IT-03	カラム順確認	保存行を目視確認	timestamp 〜 unresolved_q まで定義順で保存される
IT-04	デフォルト値確認	operatorMemo, manualSend, sourceType, unresolvedQ を省略	既定値で保存される
IT-05	複数回送信	同一ユーザが連続メッセージ送信	行が都度追加される
IT-06	bot切替確認	bot_id が異なる経路で送信	各行に正しい bot_id が保存される
IT-07	user切替確認	user_id が異なる複数ユーザで送信	各行に正しい user_id が保存される
IT-08	AI応答反映確認	応答文を変えて送信	ai_reply に実際の応答が保存される
IT-09	saver失敗時挙動	一時的に保存先設定を壊す	保存失敗がログ化され、主処理方針どおりに動作する
IT-10	シート名不一致時	誤ったシート名を設定	明示的エラーまたは fail が出る
IT-11	環境変数不備時	SPREADSHEET_ID 等を未設定にする	明示的エラーが記録される
IT-12	接続認証不備時	不正なサービスアカウントJSONで起動	接続失敗が明示化される
モジュール間の重点確認

結合テストでは、特に以下のモジュール接続を重点確認する。

1. messageService → historyService

botId

userId

userMessage

aiReply

sourceType

が欠落なく渡ること。

2. historyService → conversationRepository

正規化済みデータが repository に渡ること。

必須項目不足時は repository に到達しないこと。

3. conversationRepository → sheet/saver

conversation_history が固定シート名として使われること。

保存配列が ADR-008 定義順で構成されること。

4. sheet/saver → Google Sheets

append 処理が成功し、1行追加されること。

失敗時に異常内容が判別可能であること。

異常系テスト方針

異常系では、単に失敗することではなく、
どの層で何が壊れたかが判別できること を確認する。

確認対象は以下とする。

historyService での入力不正検知

conversationRepository での保存配列不整合検知

sheet/saver での環境変数・認証・APIエラー検知

主処理と保存処理の失敗境界の明確化

手動確認項目

結合テストでは、自動試験だけでなく以下の手動確認を行う。

No	確認項目	内容
MC-01	Renderログ確認	呼び出し開始、保存成功、保存失敗のログを確認する
MC-02	Google Sheets目視確認	行追加、列順、値の入り方を確認する
MC-03	LINE実機確認	ユーザへの返信が通常どおり返ることを確認する
MC-04	連続送信確認	複数回送信で保存が崩れないことを確認する
合格条件

結合テストの合格条件は以下とする。

正常系で conversation_history に正しい1行保存ができる

複数回保存でも列ずれが発生しない

デフォルト値が契約どおりに保存される

異常系で失敗箇所が識別できる

履歴保存失敗時の主処理挙動が設計どおりである

注意事項

本結合テストは、Google Sheets への 実書き込み確認を含む。
そのため、単体テストとは異なり、テストデータが実シートへ追加される。
必要に応じて、テスト用シートまたは識別可能なテストデータを使用する。

結論

本ADRの結合テストでは、
責務単位で分離したモジュールが、実運用経路の中で契約どおり連結されること を検証する。

これにより、ADR-008 は

設計上正しい

単体で壊れにくい

接続時も破綻しにくい

ことを段階的に確認できる。
