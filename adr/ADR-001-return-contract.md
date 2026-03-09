# ADR-001
Service返り値契約統一

## 背景
複数ファイル改修でバグが発生した。

## 決定
Serviceは必ず同一形式で返す。

{
  success: true,
  message: string,
  data: object
}

## 日付
2026-03-09
