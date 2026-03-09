# Module Design

## 目的

栄一ツールの機能をモジュール単位で整理し、
各モジュールの責務を明確にする。

---

## システム構造

```
LINE
↓
Webhook
↓
line/handler.js
↓
services
↓
repositories
↓
infra
```

---

## モジュール一覧

### 1 LINEモジュール

役割
LINEからのイベントを受け取り、処理を開始する。

主なファイル

```
line/handler.js
line/historyStore.js
```

責務

* webhookイベント受信
* message抽出
* service呼び出し

---

### 2 Serviceモジュール

役割
ビジネスロジックを担当する。

主なファイル

```
services/messageService.js
services/operatorProfileService.js
```

責務

* AI処理の呼び出し
* ペルソナ判定
* 会話生成

---

### 3 AIモジュール

役割
AIによる分類・解析。

主なファイル

```
ai/classifier.js
```

責務

* 会話分類
* 情報抽出
* 意図解析

---

### 4 Repositoryモジュール

役割
データ保存ロジックを担当。

主なファイル

```
repositories/sheetRepository.js
```

責務

* データ保存
* データ取得

---

### 5 Sheetモジュール

役割
Google Sheetsとの通信。

主なファイル

```
sheet/saver.js
```

責務

* Google API接続
* シート書き込み

---

### 6 Adsモジュール

役割
広告挿入ロジック。

主なファイル

```
ads/ads.js
ads/adService.js
```

責務

* 広告選択
* 広告生成
* 会話への挿入

---

### 7 Utilityモジュール

役割
共通機能。

主なファイル

```
utils/logger.js
```

責務

* ログ出力
* エラー管理

---

## 設計原則

1 モジュールは単一責務
2 serviceはビジネスロジックのみ
3 repositoryはデータアクセスのみ
4 infraは外部サービス接続のみ
