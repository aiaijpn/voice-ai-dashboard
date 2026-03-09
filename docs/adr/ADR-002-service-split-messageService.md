# ADR-002
messageService.js の分割

## 背景

現在の `services/messageService.js` は  
会話処理の中核を担うファイルであり、

- LINEメッセージ受信処理
- 会話履歴取得
- AI応答生成
- 広告挿入
- 応答組み立て

など複数の責務を同時に持っている。

結果として

- ファイル行数が増大
- 可読性低下
- 改修時の影響範囲が不明確
- バグ混入リスク増大

という問題が発生している。

実測では
services/messageService.js
約243行


となっており、  
今後の機能拡張（広告モジュール / キャラAI / 会話履歴強化）を考えると  
**単一ファイル維持は危険**と判断した。

---

## 決定

`messageService.js` を  
**責務別モジュールへ分割する。**

分割後の構成は以下とする。


services
├ messageService.js (入口のみ)
├ conversationService.js (AI会話生成)
├ historyService.js (会話履歴管理)
├ adService.js (広告挿入)
└ responseBuilder.js (最終返信生成)


### messageService.js の役割

- handler から呼ばれる **入口サービス**
- 各サービスのオーケストレーションのみ行う

### conversationService.js

役割

- AIへプロンプト送信
- 応答生成

### historyService.js

役割

- 会話履歴取得
- 会話履歴保存

### adService.js

役割

- 広告挿入ロジック
- 広告頻度制御

### responseBuilder.js

役割

- AI応答 + 広告 + その他要素を統合
- LINE返信テキスト生成

---

## 目的

この分割により

- 責務分離
- 改修範囲の明確化
- 将来機能追加の容易化
- バグ混入リスク削減

を実現する。

---

## 分割ルール

今後のコード規約として

**1ファイル150行以内を推奨**

超えた場合は

- Service分割
- Utility抽出
- モジュール化

を検討する。

---

## 影響範囲

修正対象


services/messageService.js


追加ファイル


services/conversationService.js
services/historyService.js
services/adService.js
services/responseBuilder.js


handler からの呼び出し構造は変更しない。


handler
↓
messageService
↓
各Service


---

## 将来拡張

この構造は  
将来的な以下の機能を想定している。

- キャラAIモジュール
- セグメント広告
- AI人格管理
- 会話分析

その際は


services
├ personaService.js
├ segmentService.js


などを追加する。

---

## 日付

2026-03-09
技術的コメント（重要）

今回のADR-002は
栄一ツールの品質を一段上げる重要ADRです。

理由：

ADR-001
返り値契約

ADR-002
サービス分割

この2つが揃うと

壊れないコード構造

になります。

これはプロジェクト的にかなり大きい一歩です。

次ステップ提案

次に作ると ドキュメント体系が完成するADR はこれです。

ADR-003

Controller / Service / Repository 層分離

これを作ると

栄一ツールは

完全プロ構造

になります。