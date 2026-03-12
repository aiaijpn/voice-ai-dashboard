# ADR-003
LINE送信エンジン統一（Delivery Engine）

## 日付
2026-03-12

---

# 背景

現在の栄一ツールは以下の構造でLINE返信を行っている。
LINE Webhook
↓
handler
↓
messageService
↓
LINE reply

しかし今後、以下の機能追加を予定している。

- LIFF ミニアプリ
- AI定期配信（Scheduler）
- 高機能広告
- セグメント配信

これらはすべて **LINEへメッセージ送信** を行う。

もし送信処理がそれぞれのモジュールに分散すると、以下の問題が発生する。

- 送信コードの重複
- バグ増加
- 仕様変更時の修正範囲拡大
- 送信ログ管理の複雑化

そのため、LINE送信処理を **共通エンジンへ統一** する。

---

# 決定


LINEへの送信処理はすべて
modules/lineSender.js

を経由して実行する。

各サービスは **送信対象と送信内容を決定する責務のみ持つ。**

LINE Messaging API の直接呼び出しは禁止する。

---

# 目的

送信処理を **Delivery Layer** として独立させる。

これにより

- 送信処理の一元化
- バグ削減
- 機能追加の容易化
- ログ統一
- 将来の配信拡張

を実現する。

---

# 構造

## Before
Webhook
↓
messageService
↓
LINE返信

将来構造（分散）
Webhook
↓
messageService
↓
LINE送信

LIFF
↓
API
↓
LINE送信

Scheduler
↓
定期配信
↓
LINE送信

送信ロジックが分散してしまう。

---

## After（統一構造）
Webhook
↓
messageService
↓
lineSender
↓
LINE

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


**LINE送信はすべて lineSender を通る。**

---

# レイヤ構造

栄一ツールの構造は以下の3層になる。


Input Layer
↓
Processing Layer
↓
Delivery Layer


### Input Layer

- LINE Webhook
- LIFF
- Scheduler

### Processing Layer

- messageService
- AI処理
- 広告挿入
- セグメント判定

### Delivery Layer

- lineSender

---

# 追加モジュール


modules/lineSender.js


役割

- LINE Messaging API 呼び出し
- reply送信
- push送信
- broadcast送信
- 送信ログ統一
- エラーハンドリング

---

# lineSender API

最小構成


sendReply(replyToken, messages)

sendPush(userId, messages)

sendBroadcast(messages)


messages は LINE Messaging API 形式の配列とする。

例


[
{
"type": "text",
"text": "こんにちは"
}
]


---

# 設計原則

## lineSender に入れるもの

- LINE SDK 呼び出し
- メッセージ送信
- APIエラー処理
- 送信ログ

## lineSender に入れないもの

- AI応答生成
- 広告判断
- セグメント判定
- 配信スケジューリング
- ペルソナ判断

これらは **Processing Layer の責務** とする。

---

# 返り値契約

返り値は ADR-001 に準拠する。

成功


{
success: true,
message: "LINE message sent",
data: {
method: "reply"
}
}


失敗


{
success: false,
message: "LINE send failed",
data: {
error: "error message"
}
}


---

# 注意事項

## replyToken制約

reply送信は **Webhookイベントのみ** 使用可能。

LIFFやSchedulerでは使用できない。

---

## push送信

push送信は **userId が必須**。

そのため userId 保存戦略が必要。

---

## broadcast

broadcast は将来拡張とする。

初期段階では未使用でもよい。

---

# メリット

## ① LINE送信ロジックが1箇所

コード重複防止  
バグ削減

---

## ② 新機能が容易

以下の機能が同一エンジンで利用できる

- LIFF
- AI定期配信
- 広告配信
- セグメント配信

---

## ③ 拡張性

将来

- メール
- SMS
- Web Push

などの送信チャネルを追加しやすい。

---

# 実装影響範囲

追加


modules/lineSender.js


修正


services/messageService.js


---

# 実装ステップ

Step1  
lineSender 作成

Step2  
messageService の reply送信を lineSender 経由へ変更

Step3  
push送信対応

Step4  
Scheduler配信へ接続

Step5  
LIFF配信へ接続

---

# 将来ADR

ADR-004  
LIFF 入口統一  

ADR-005  
定期配信モジュール  

ADR-006  
Controller / Service / Repository 分離
技術コメント（短く）

このADRは
栄一ツールの構造安定化に効く重要ADRです。

今まで

LINE返信 = messageService

だったものが

LINE返信 = lineSender

に変わるので、
今後のLIFF / Scheduler / 広告が全部楽になります。
