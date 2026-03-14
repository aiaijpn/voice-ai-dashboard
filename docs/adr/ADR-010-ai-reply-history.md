# ADR-010  
AI Reply History 保存

## Status

Accepted

## Date

2026-03-14

---

## 背景

栄一ツールでは、会話履歴を `conversation_history` に保存し、
将来的に **AI会話引継ぎ** を成立させる方針を採用している。

ここまでの流れは以下の通り。

- ADR-007: 保存契約固定
- ADR-008: `conversation_history` 保存
- ADR-009: `admin_message` 保存

この時点で、履歴には以下が保存されている。

- `user_message`
- `admin_message`

しかし、AIが実際に返した返信内容 (`ai_reply`) が履歴に残っていないため、
会話履歴としてはまだ不完全である。

AI会話引継ぎに必要なのは、

- ユーザが何を言ったか
- 管理者が何を送ったか
- AIが何を返したか

の3点である。

特に AI会話では、

**履歴 = 世界**

であり、`ai_reply` が保存されていない状態では、
次回会話時に AI が過去の応答文脈を正しく参照できない。

そのため、ADR-010 では
**AI返信を `conversation_history` に保存する** ことを決定する。

---

## 決定

AI返信生成後、`historyService.saveConversationHistory()` を呼び出し、
`sourceType = "ai_reply"` として `conversation_history` に保存する。

保存は **既存の保存経路をそのまま利用** する。

保存経路:

```text
messageService
↓
historyService
↓
conversationRepository
↓
sheet/saver
↓
Google Sheets

今回の ADR では、
Repository構造の整理や再編は行わない。

理由は、現在の優先順位が以下であるため。

ADR-007 保存契約固定
↓
ADR-008 conversation_history 保存
↓
ADR-009 admin_message 保存
↓
ADR-010 ai_reply 保存
↓
ADR-011 履歴取得
↓
Repository整理

つまり、先にやるべきことは
履歴仕様の完成 であり、
Repository整理はその後に行う。

したがって ADR-010 は、

既存履歴へ最小差分で ai_reply を追加する

保存契約を壊さない

Repository統一・整理とは衝突しない

という方針で実装する。

保存対象

conversation_history の sourceType に
以下を追加・確定する。

sourceType	説明
user_message	ユーザ発言
admin_message	管理者送信
ai_reply	AI返信
system_event	システムイベント
保存データ形式

AI返信保存時のデータ形式は以下とする。

{
  "botId": "voice-ai-dash",
  "userId": "Uxxxxxxxx",
  "timestamp": 1710000000000,
  "sourceType": "ai_reply",
  "userMessage": "",
  "aiReply": "AIが生成した返信本文",
  "operatorMemo": "",
  "manualSend": false,
  "unresolvedQ": false
}
項目ルール

botId: 対象BOT ID

userId: 対象ユーザID

timestamp: 保存時刻

sourceType: "ai_reply"

userMessage: 空文字

aiReply: AI返信本文

operatorMemo: 原則空文字

manualSend: false

unresolvedQ: 原則 false

実装方針

AI返信本文 (replyText) が確定した直後に、
saveConversationHistory() を呼ぶ。

実装イメージ:

await saveConversationHistory({
  botId,
  userId,
  timestamp: Date.now(),
  sourceType: "ai_reply",
  userMessage: "",
  aiReply: replyText,
  operatorMemo: "",
  manualSend: false,
  unresolvedQ: false,
});

保存位置は、原則として
services/messageService.js の AI返信確定直後 とする。

修正対象ファイル
主修正

services/messageService.js

確認対象

services/historyService.js

sourceType: "ai_reply" を許容しているか確認

line/handler.js

messageService に botId, userId が十分渡っているか確認

原則変更不要

repositories/conversationRepository.js

sheet/saver.js

server.js

新規ドキュメント

docs/adr/ADR-010-ai-reply-history.md

このADRでやらないこと

以下は ADR-010 の対象外とする。

1. 履歴取得

履歴の読み込み、過去会話の取得、AIへの再注入は行わない。
これは ADR-011 の範囲とする。

2. Repository整理

conversationRepository / sheetRepository / historyRepository などの
再編・統一は行わない。
これは履歴仕様完成後に別途整理する。

3. broadcast 履歴保存

broadcast API は個別 userId が取得できないため、
本ADRでは対象外とする。

4. unresolvedQ の高度判定

AI返信に対する未解決判定ロジックは本ADRでは扱わない。

理由
1. 履歴仕様を先に完成させるため

Repository整理を先に行うと、
履歴仕様変更により再修正が必要になる可能性が高い。

そのため順序は

履歴仕様完成
↓
Repository整理

が正しい。

2. 最小差分で安全に進めるため

ADR-009 までで保存基盤は完成しているため、
ADR-010 は 保存入口を1つ増やすだけ で対応できる可能性が高い。

3. AI会話引継ぎの前提条件だから

AI会話引継ぎには

保存

履歴取得

の両方が必要である。

ADR-010 はこのうち
保存側の完成 にあたる。

期待される効果
1. 会話履歴の完全性向上

以下の3種類が揃う。

user_message

admin_message

ai_reply

これにより、会話履歴がイベントログとして完成に近づく。

2. ADR-011 に進める

次段階である履歴取得の実装が可能になる。

3. 将来のDB移行が安全になる

保存契約を固定したまま、保存先を

Google Sheets

Database

へ差し替えやすくなる。

デメリット / 注意点
1. 同一会話で保存件数が増える

1会話あたり、

user_message

ai_reply

の2行以上が保存される可能性がある。

2. 保存失敗時の扱いを明確化する必要がある

AI返信送信自体は成功しても、
履歴保存が失敗するケースはあり得る。

したがって、履歴保存失敗は
返信失敗とは分離したログ管理
を行う必要がある。

3. 重複保存に注意

同じ replyText に対して複数回 saveConversationHistory() を呼ばないよう、
保存位置は1箇所に絞る。

成功条件
Renderログ

以下のようなログが確認できること。

AI reply generated
AI reply history save requested
AI reply history saved
Google Sheets

conversation_history に以下の行が追加されること。

項目	値
sourceType	ai_reply
userMessage	""
aiReply	AI返信本文
manualSend	FALSE
今後の流れ

次の段階は ADR-011 とする。

ADR-011

Conversation History Load

目的:

conversation_history から過去履歴を取得する

AI会話時に必要履歴を再注入する

AI会話引継ぎを成立させる

順序:

ADR-007 保存契約固定
↓
ADR-008 conversation_history 保存
↓
ADR-009 admin_message 保存
↓
ADR-010 ai_reply 保存
↓
ADR-011 履歴取得
↓
Repository整理
結論

ADR-010 では、
AI返信を conversation_history に
sourceType = "ai_reply" として保存する。

これは Repository整理より先に行うべき
履歴仕様完成の一部 であり、
既存保存基盤への最小差分追加として実装する。


必要なら次に、そのまま実装に入れるように  
**「ADR-010 実装手順（修正ファイルごと完コピ版）」** を出します。

**決定カウンター: 12**  
流れは良いです。いまは「構造整理したくなる欲」を抑えて、履歴仕様を最後まで閉じる局面です。これは後のマネタイズ導線にも効きます。
