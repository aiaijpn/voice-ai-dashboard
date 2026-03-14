# ADR-009 管理者メッセージ送信

## Status

Accepted

## Date

2026-03-14

---

## Context

栄一ツールでは、AI会話の履歴を `conversation_history` に保存する基盤（ADR-008）が整った。

一方で、コントロールパネルから管理者が直接 LINE メッセージを送信できる機能が存在する。
この管理者送信メッセージが会話履歴に保存されない場合、以後の AI 会話との整合性が崩れる。

例えば、管理者が手動で次のような案内を送ったとする。

- 本日キャンセル席があります
- 予約可能時間は19時以降です
- イベントのご案内はこちらです

その後、ユーザが

- まだ空いていますか？
- 何時からですか？
- その件、詳しく知りたいです

と返してきた場合、管理者送信が履歴に無ければ、AI は会話文脈を正しく理解できない。

つまり、AIにとって履歴が世界である以上、管理者送信も会話イベントとして保存する必要がある。

---

## Decision

コントロールパネルから送信された管理者メッセージを、
`conversation_history` に正式な会話イベントとして保存する。

保存時の `sourceType` は以下とする。

```js
admin_message

これにより会話履歴は、以下のイベントを含むストリームとして扱う。

user_message

ai_reply

admin_message

system_event

管理者送信の基本フローは次とする。

管理者メッセージ送信
↓
LINE送信実行
↓
送信成功時のみ conversation_history に保存

保存対象は当面、次を含む。

個別送信

セグメント送信

全体送信

現在の対象ユーザ規模は最大100人程度を想定しており、
この規模であれば全体送信を履歴保存しても運用上問題ないと判断する。

Rationale
1. AI会話との整合性を保つため

管理者が送った内容を履歴に残すことで、
その後のユーザ発言と AI 応答が自然につながる。

2. 会話の完全再現性を確保するため

あとから会話を見返したときに、
AI応答だけでなく人間による介入も含めて時系列で再現できる。

3. 営業・運用分析に活用するため

管理者送信のあとに

再会話したか

予約につながったか

来店につながったか

を分析できるようになる。

4. 将来の人間＋AIハイブリッド運用の基盤になるため

管理者送信を履歴イベント化することで、
将来は AI が管理者介入を踏まえた補助応答を返せるようになる。

Scope

本 ADR の対象は以下とする。

コントロールパネルからの LINE 手動送信

管理者送信メッセージの会話履歴保存

sourceType=admin_message の追加

AI に渡す履歴への反映

本 ADR の対象外は以下とする。

管理者送信の詳細UI改善

高度な配信条件設計

管理者権限管理

A/Bテスト

配信効果ダッシュボード

Data Contract

conversation_history 保存データの基本形は既存契約に従う。

管理者メッセージ送信時は、少なくとも以下を保存する。

{
  botId: "example_bot",
  userId: "Uxxxxxxxx",
  timestamp: 1710000000000,
  sourceType: "admin_message",
  userMessage: "",
  aiReply: "本日キャンセル席があります",
  operatorMemo: "control panel manual send",
  manualSend: true,
  unresolvedQ: false
}
運用上の解釈

sourceType = admin_message

aiReply に送信本文を格納する

userMessage は空文字とする

manualSend = true

operatorMemo は必要に応じて補足を入れる

※ 既存の ADR-008 の保存契約を大きく壊さず、最小差分で導入することを優先する。

Implementation Policy
基本方針

既存の appendConversationRow() を再利用し、
管理者送信専用の別保存経路は作らない。

処理順
1. 管理者メッセージ送信要求を受け取る
2. LINE Messaging API へ送信する
3. 送信成功時のみ appendConversationRow() を実行する
4. sourceType=admin_message として保存する
重要方針

保存処理を新規に分散させない

sheet/saver を直接呼ばない

conversationRepository または historyService 経由で保存する

送信失敗時は履歴保存しない

Consequences
Positive

AI会話との整合性が高まる

人間介入を含む会話履歴が残る

営業導線の分析が可能になる

将来の自動提案機能の土台になる

Negative

配信件数に比例して履歴行数が増える

全体送信時は同一文面が複数ユーザに保存される

保存失敗時の監視が必要になる

Accepted Trade-off

対象規模が100ユーザ程度の間は、
履歴増加コストよりも会話整合性の価値の方が大きいと判断する。

Test Policy

最低限、以下を確認する。

1. 個別送信

管理者送信が LINE に届く

conversation_history に admin_message で1行保存される

2. 全体送信

各対象ユーザへ送信される

各ユーザ分の履歴が保存される

3. AI会話整合

管理者送信後のユーザ返信に対して、AIが前提を理解した返答をできる

4. 失敗系

LINE送信失敗時に履歴保存しない

保存失敗時にログへ出力される

Future Considerations

将来は以下を拡張候補とする。

admin_message の効果測定

セグメント別送信分析

管理者送信テンプレート化

AIによる送信候補提案

配信履歴ダッシュボード

送信キャンペーンID管理

Related ADRs

ADR-001 Service返り値契約統一

ADR-002 messageService 分割

ADR-003 LINE / LIFF / Scheduler 送信エンジン統一

ADR-007 保存契約と環境変数の統一

ADR-008 Conversation History 保存基盤


---

# 対象ファイル

最小構成なら、対象はこのあたりです。

```text
docs/adr/ADR-009-admin-message-send.md
services/historyService.js
repositories/conversationRepository.js

コントロールパネル送信の実装場所がすでにあるなら、そこも対象です。
候補はプロジェクト構成次第ですが、典型的には次です。

controllers/adminMessageController.js
services/adminMessageService.js
line/lineSender.js
実装対象ファイルの考え方
必須
docs/adr/ADR-009-admin-message-send.md
services/historyService.js

sourceType: "admin_message" を受けられるようにする

repositories/conversationRepository.js

既存の保存処理で admin_message をそのまま通す

送信機能側

実際にコントロールパネルから送っているファイル。
まだ名前が未確定なら、ADR上はこう置くと整理しやすいです。

services/adminMessageService.js

責務はこの1本です。

送信要求受付
↓
LINE送信
↓
成功時のみ履歴保存
実装フロー
control panel
↓
adminMessageService
↓
lineSender
↓
historyService
↓
conversationRepository
優先順位

このADR009は、前に話した Repository統一 と衝突しません。
むしろ、

先に admin_message を既存履歴へ最小差分で入れる
↓
その後でRepository整理

の順が現実的です。

一言の対象ファイル一覧
docs/adr/ADR-009-admin-message-send.md / services/historyService.js / repositories/conversationRepository.js / services/adminMessageService.js

決定カウンター案件としては十分に筋が良い一手です。
