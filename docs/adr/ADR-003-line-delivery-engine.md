# ADR-003
LINE送信エンジン統一（Delivery Engine）

## 背景

栄一ツールではLINE Messaging APIを使用して返信を行っている。

初期実装では、`line/handler.js` 内で直接 LINE API を呼び出していた。


axios.post("https://api.line.me/v2/bot/message/reply
", ...)


この状態では今後予定している機能

- LIFF ミニアプリ
- AI定期配信（Scheduler）
- 広告配信
- セグメント配信

などで **LINE送信処理が複数箇所に分散する** 問題がある。

これにより

- 重複コード
- 修正範囲の拡大
- バグ増加

が発生する。

---

## 決定

LINE Messaging API 呼び出しは  
**modules/lineSender.js に統一する。**

すべてのLINE送信は


lineSender.sendReply()
lineSender.sendPush()
lineSender.sendBroadcast()


を経由する。

直接 LINE API を呼ばない。

---

## 変更前


LINE Webhook
↓
line/handler.js
↓
axios.post(LINE API)


---

## 変更後


LINE Webhook
↓
line/handler.js
↓
modules/lineSender.js
↓
LINE Messaging API


---

## 将来構造


Webhook
↓
handler
↓
service
↓
lineSender
↓
LINE API


また今後の機能も同じ送信エンジンを使用する。


LIFF
↓
liffController
↓
lineSender
↓
LINE

Scheduler
↓
deliveryService
↓
lineSender
↓
LINE


---

## 新規モジュール


modules/lineSender.js


責務

- LINE API 呼び出し
- reply送信
- push送信
- broadcast送信
- エラーハンドリング
- 送信ログ

---

## lineSender API

### sendReply


sendReply(replyToken, messages)


### sendPush


sendPush(userId, messages)


### sendBroadcast


sendBroadcast(messages)


messages は LINE Messaging API 形式。

例


[
{
"type": "text",
"text": "こんにちは"
}
]


---

## lineSender に入れないもの

以下は **Service 層の責務**

- AI応答生成
- 広告挿入
- セグメント判定
- スケジューラ
- ペルソナ制御

lineSender は **送信のみ担当する。**

---

## 実装

### 新規


modules/lineSender.js


### 修正


line/handler.js


変更内容


axios.post("https://api.line.me/v2/bot/message/reply
")


を削除し


lineSender.sendReply()


へ置換。

---

## 期待効果

- LINE送信ロジックの統一
- バグ削減
- 修正箇所の限定
- 将来機能追加の容易化

---

## 関連ADR


ADR-001 Service返り値契約統一
ADR-002 messageService分割
ADR-002B messageService内部モジュール化


---

## 将来ADR


ADR-004 LINE送信機能拡張
ADR-005 Scheduler配信
ADR-006 Controller / Service / Repository 分離


---

## ステータス


Implemented


実装日


2026-03-12
