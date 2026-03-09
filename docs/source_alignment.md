# Source Alignment Memo

## 目的

ドキュメントとソースコードの整合性を確認し、
差分や未実装部分を記録する。

---

## 現在の整合状況

概ね一致しているが、
以下の点で軽微なズレが存在する。

---

# 不整合メモ

## 1 Persona Engine

### ドキュメント

```text
Persona Engine
```

### 実装

```text
data/operatorProfile.json
services/operatorProfileService.js
```

### 状況

完全なエンジンではなく
設定データ＋サービス。

### 対応

将来

```text
personaEngine.js
```

として整理予定。

---

## 2 Conversation Engine

### ドキュメント

```text
Conversation Engine
```

### 実装

```text
services/messageService.js
```

### 状況

Conversation Engine の実体は
messageService に存在する。

### 対応

ドキュメントに追記予定。

---

## 3 Ad Engine

### ドキュメント

```text
Ad Engine
```

### 実装

```text
ads/adService.js
```

### 状況

実装済み。

README への記載が未反映。

---

# 整合率

現在の整合率

```text
約85%
```

---

# 方針

現段階では
大きな構造変更は不要。

以下を優先する。

```text
1 Conversation Engine整理
2 Persona Engine拡張
3 ドキュメント更新
```
