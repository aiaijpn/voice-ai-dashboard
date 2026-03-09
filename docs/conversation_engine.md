# Conversation Engine

## 目的

Conversation Engine は
栄一ツールの **中核エンジン**である。

ユーザーとの会話を通じて

* 情報収集
* 会話生成
* AI解析
* 広告挿入
* データ保存

を統合的に処理する。

---

# 全体フロー

システムの会話処理は以下の流れで動作する。

```
LINEユーザー
↓
Webhook
↓
line/handler.js
↓
messageService
↓
Conversation Engine
↓
AI / Ads / Persona
↓
Google Sheets保存
↓
返信メッセージ生成
↓
LINE返信
```

---

# Conversation Engineの構成

Conversation Engine は
以下の3つのサブシステムで構成される。

```
1 Persona Engine
2 AI Engine
3 Ad Engine
```

---

# 1 Persona Engine

## 役割

ユーザーの属性に応じて
会話スタイルや情報内容を調整する。

## 入力

```
ユーザーメッセージ
ユーザープロフィール
会話履歴
```

## 出力

```
会話トーン
興味ジャンル
広告対象カテゴリ
```

---

# 2 AI Engine

## 役割

ユーザーのメッセージを解析し
会話内容を生成する。

## 主な処理

```
意図解析
感情判定
カテゴリ分類
回答生成
```

## 実装

```
ai/classifier.js
```

---

# 3 Ad Engine

## 役割

会話の流れを壊さず
自然な形で広告を挿入する。

## 広告判断

以下の条件で広告を選択する。

```
ユーザー興味
会話カテゴリ
会話回数
広告頻度
```

---

# 会話生成ロジック

Conversation Engine は以下の順序で処理を行う。

```
1 メッセージ受信
2 会話履歴取得
3 ペルソナ解析
4 AI応答生成
5 広告選択
6 応答生成
7 データ保存
8 LINE返信
```

---

# 会話履歴管理

会話履歴は以下で管理される。

```
line/historyStore.js
```

履歴の役割

```
文脈保持
ユーザー理解
AI応答改善
```

---

# 会話品質向上

Conversation Engine は
以下を重視する。

```
自然な会話
継続利用
ユーザー価値
```

---

# 将来拡張

Conversation Engine は
以下の機能拡張を予定する。

```
感情解析
会話パーソナライズ
広告最適化
コミュニティ生成
```

---

# 設計原則

Conversation Engine の設計原則は以下。

```
1 会話中心設計
2 AIは裏方
3 ユーザー体験優先
4 モジュール分離
```

---

# 栄一ツールの核心

栄一ツールの価値は
Conversation Engine にある。

```
AI
ペルソナ
広告
```

を統合することで

```
会話型コミュニティシステム
```

を実現する。
