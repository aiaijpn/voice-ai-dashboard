# Coding Rules

## 目的

栄一ツールのコード品質を一定に保ち、
バグ発生を防ぐ。

---

# 基本原則

1 モジュール分離
2 単一責務
3 Service中心設計
4 返り値契約統一

---

# フォルダ責務

| フォルダ         | 責務       |
| ------------ | -------- |
| routes       | API入口    |
| services     | ビジネスロジック |
| repositories | データアクセス  |
| infra        | 外部API接続  |

---

# Service返り値契約

Serviceは必ず以下の形式で返す。

```id="r1r5tv"
{
 success: true,
 message: string,
 data: object
}
```

例

```id="tawj2v"
return {
 success: true,
 message: "ok",
 data: result
}
```

---

# Logger使用

ログ出力は必ず logger を使用。

```id="ulq3b1"
const { log, error } = require("../utils/logger");
```

---

# 環境変数

直接参照は禁止。

server.jsでチェックする。

例

```id="u9e0z9"
process.env.OPENAI_API_KEY
```

---

# ファイルサイズ

推奨

```id="3m4z5v"
150行以内
```

最大

```id="7clg5a"
300行
```

超える場合は分割する。

---

# 命名規則

Service

```
xxxService.js
```

Repository

```
xxxRepository.js
```

Route

```
xxxRoute.js
```

---

# エラー処理

例外は必ずcatchする。

```id="grq4mb"
try {

} catch (err) {
 error(err)
}
```

---

# commit規則

```
feat: 新機能
fix: バグ修正
docs: ドキュメント
refactor: 構造改善
```
