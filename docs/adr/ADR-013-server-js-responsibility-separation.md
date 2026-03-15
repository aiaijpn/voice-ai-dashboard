# ADR-013: server.js の責務分離

## Status

Accepted

2026-03-15

---

## 背景

現在の `server.js` は以下の複数の責務を同時に持っている。

- サーバ起動
- 環境変数チェック
- middleware登録
- Basic認証
- health check
- Operator Panel HTML
- Operator tone変更
- 個別送信（LINE push）
- broadcast送信
- webhook受信
- listen起動

これにより以下の問題が発生する。

1. Route定義と業務処理が混在する  
2. Operator Panel のHTMLが巨大化する  
3. 認証 / health / webhook / operator 機能が同居する  
4. 修正時の影響範囲が読みにくい  
5. 将来の multi-bot 拡張や機能追加時に入口が肥大化する

Expressアプリケーションの入口として  
`server.js` は **最小責務に保つことが望ましい**。

---

## 決定

`server.js` の責務を分離し、以下の構造へ移行する。

### server.js の責務

`server.js` は次のみを担当する。

- app生成
- 共通middleware登録
- route mount
- server listen

業務ロジックは含めない。

---

### middleware

認証処理は middleware として独立させる。


middleware/basicAuth.js


---

### health routes

ヘルスチェック用ルートを分離する。


routes/health.js


対象


GET /
GET /health
GET /healthz


---

### operator routes

Operator Panel 関連ルートを分離する。


routes/operatorPanel.js


対象


GET /operator
POST /operator/tone
POST /operator/send
POST /operator/broadcast


---

### webhook route

LINE Webhook 受信ルートを分離する。


routes/webhook.js


対象


POST /webhook


ただし webhook は入口性が高いため  
分離は **段階的に実施**する。

---

### service 分離（推奨）

Operator送信処理は service に寄せる。

例


services/operatorSendService.js
services/operatorBroadcastService.js


route は **ルーティング責務のみ**にする。

---

## 実装順（安全手順）

一度に分割すると事故率が上がるため  
以下の順序で実施する。

1. basicAuth を middleware 分離
2. health routes 分離
3. operator routes 分離
4. operator send / broadcast を service 化
5. webhook route 分離

---

## 影響

このADRにより

- server.js が軽量化される
- route と business logic の責務が分離される
- 将来の機能追加が容易になる
- operator panel 拡張の安全性が上がる
- multi-bot / multi-operator 構造への拡張余地が確保される

---

## 関連ADR


ADR-009 admin_message 保存
ADR-010 ai_reply 保存
ADR-011 履歴取得
ADR-012 ファイル分割ルール


ADR-012 は **一般的な分割原則**  
ADR-013 は **server.js への具体適用** である。
補足（実務判断）

この ADR は良い判断です。

理由はシンプルで、
server.js が太ると開発速度が落ちるからです。

特にあなたのプロジェクトは

Operator Panel

AI会話

顧客履歴

broadcast

将来 multi-bot

と入口が膨らみやすい構造です。

入口を薄くしておくことは
実装速度＝収益化速度に直結します。
