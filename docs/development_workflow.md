# Development Workflow

## 目的

栄一ツールの開発を安全かつ効率的に進めるため、
開発の手順を統一する。

---

# 基本フロー

開発は以下の順序で行う。

```id="r7z3kl"
1 設計
2 実装
3 動作確認
4 commit
5 push
6 ドキュメント更新
```

---

# Step1 設計

新しい機能を作る前に
設計ドキュメントを確認する。

対象

```id="ftb7od"
docs/system_architecture.md
docs/module_design.md
docs/conversation_engine.md
```

必要に応じて

```id="z7gk6a"
docs/
```

に設計を追加する。

---

# Step2 実装

実装は以下のレイヤーで行う。

```id="iy3m2v"
routes
↓
services
↓
repositories
↓
infra
```

原則

* serviceにロジックを書く
* repositoryはデータ処理のみ

---

# Step3 動作確認

ローカルで起動。

```id="s6mqdx"
node server.js
```

確認項目

```id="h0q1ym"
LINE応答
AI処理
シート保存
```

---

# Step4 commit

変更をcommitする。

```id="38t3m2"
git add .
git commit -m "message"
```

commitメッセージ例

```id="p6mm9p"
feat: add ad module
fix: bug in handler
docs: update architecture
refactor: split server.js
```

---

# Step5 push

GitHubへ送信。

```id="a4y2vl"
git push
```

---

# Step6 ドキュメント更新

機能追加した場合は

```id="ym0st5"
docs/
```

を更新する。

対象

```id="9q2u6h"
module_design.md
conversation_engine.md
ad_module.md
```

---

# 開発ルール

以下を必ず守る。

```id="os12qv"
1 serviceにロジックを書く
2 repositoryにDB処理を書く
3 handlerは薄くする
4 loggerを使用する
```

---

# ファイルサイズルール

目安

```id="o7tf83"
150行
```

最大

```id="hrq9z8"
300行
```

超えた場合

```id="g5u1c1"
refactor
```

を検討する。

---

# バグ発生時

手順

```id="k3c9dp"
1 bug-log.md に記録
2 原因分析
3 修正
4 再発防止
```

---

# 栄一ツール開発方針

重要な考え方

```id="ndx8av"
小さく作る
早く動かす
改善する
```

---

# 最終目的

栄一ツールは

```id="0h8y6q"
AI会話
ペルソナ
広告
```

を統合した

```id="6a5qdz"
会話型ビジネスプラットフォーム
```

を目指す。
