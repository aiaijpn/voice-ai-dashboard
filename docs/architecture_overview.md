# Architecture Overview

## 概要

栄一ツール（voice-ai-dashboard）は
LINE上での会話を通じて

* ユーザーの声を収集
* AI解析
* データ保存
* 広告・情報提供

を行う **AI会話型ダッシュボードシステム**である。

---

# システム構造

```
LINE User
   ↓
LINE Webhook
   ↓
line/handler.js
   ↓
Service Layer
   ↓
AI Engine
   ↓
Repository Layer
   ↓
Google Sheets
```

---

# モジュール構造

```
server.js
   ↓
routes
   ↓
services
   ↓
repositories
   ↓
infra
```

---

# 主要モジュール

## LINE Module

役割
LINEメッセージ受信とイベント処理。

```
line/handler.js
line/historyStore.js
```

---

## Service Module

役割
ビジネスロジック。

```
services/messageService.js
services/operatorProfileService.js
```

---

## AI Module

役割
メッセージ解析。

```
ai/classifier.js
```

---

## Repository Module

役割
データ保存処理。

```
repositories/sheetRepository.js
```

---

## Infrastructure

外部サービス接続。

```
sheet/saver.js
utils/logger.js
```

---

# データフロー

```
User Message
   ↓
LINE Webhook
   ↓
handler
   ↓
messageService
   ↓
AI classifier
   ↓
Sheet Repository
   ↓
Google Sheets
```

---

# Conversation Engine

栄一ツールの中核。

構成

```
Persona Engine
AI Engine
Ad Engine
```

---

# 設計原則

1. 単一責務
2. モジュール分離
3. Service中心設計
4. 外部API分離

---

# 将来拡張

予定されている拡張。

* AI会話高度化
* 広告最適化
* ペルソナ自動生成
* コミュニティ形成
