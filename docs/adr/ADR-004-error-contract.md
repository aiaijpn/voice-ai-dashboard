# 

## Status
Proposed

## Date
2026-03-12

---

# 背景

ADR-001 により Service の返り値契約は統一された。


{
success: boolean,
message: string,
data: object | null
}


しかし現在、**エラー時の返却契約は統一されていない。**

実装によって以下の揺れが発生する可能性がある。

- messageのみ返却
- null返却
- throw
- 外部APIエラーをそのまま返却
- ログだけ出力

この状態だと将来の機能で問題が起きる。

予定機能

- Scheduler配信
- LIFF
- Queue処理
- セグメント配信
- 広告配信
- classifier拡張

失敗時の扱いがバラバラだと

- handler分岐が増える
- retry判断不能
- ログ分析不能
- 障害原因特定困難

になる。

そのため **成功契約だけでなく失敗契約も固定する。**

---

# 決定

Service / Module の失敗返却は以下形式に統一する。


{
success: false,
message: "エラー概要",
data: null,
error: {
code: "ERROR_CODE",
retryable: boolean,
severity: "low | medium | high"
}
}


---

# 成功契約


{
success: true,
message: "処理成功",
data: {}
}


---

# 失敗契約


{
success: false,
message: "処理失敗",
data: null,
error: {
code: "ERROR_CODE",
retryable: false,
severity: "medium"
}
}


---

# errorオブジェクト

|項目|型|説明|
|---|---|---|
|code|string|機械判定用エラーコード|
|retryable|boolean|再試行価値|
|severity|string|重要度|
|detail|object\|null|内部情報(任意)|
|cause|string\|null|原因説明(任意)|

---

# error.code 命名規則

形式


<領域>_<原因>


例


LINE_SEND_ERROR
LINE_REPLY_ERROR
OPENAI_TIMEOUT
OPENAI_REQUEST_ERROR
SHEET_APPEND_ERROR
HISTORY_SAVE_ERROR
INVALID_ARGUMENT
UNAUTHORIZED_REQUEST
QUEUE_PUSH_ERROR
UNKNOWN_INTERNAL_ERROR


ルール

- 英大文字
- 単語区切り `_`
- 外部サービス名を先頭に置く

---

# severity

|値|意味|
|---|---|
|low|軽微|
|medium|注意|
|high|重大|

---

# retryable

retry可能

- timeout
- API一時失敗
- ネットワーク断
- レート制限

retry不可

- 引数不正
- 認証不正
- userId不正
- replyToken欠落
- 契約違反

---

# 実装ルール

## Serviceはthrowを避ける

通常処理では throw を使わず fail 返却する。

throw は以下のみ。

- 起動不能
- 契約違反
- 想定外致命バグ

---

## 外部APIエラーを直接返さない

LINE  
OpenAI  
Sheets  

などの生エラーは返さず

内部 error.code に変換する。

---

# 例

## LINE送信失敗


{
success:false,
message:"LINE送信失敗",
data:null,
error:{
code:"LINE_SEND_ERROR",
retryable:true,
severity:"medium"
}
}


---

## 引数不正


{
success:false,
message:"引数不正",
data:null,
error:{
code:"INVALID_ARGUMENT",
retryable:false,
severity:"high"
}
}


---

# 共通関数

utils/serviceResponse.js を拡張する。


success(message,data)

fail(message,code,options)


例


fail(
"LINE送信失敗",
"LINE_SEND_ERROR",
{ retryable:true,severity:"medium" }
)


---

# 適用範囲

適用対象


services/*
modules/*
repositories/*
lineSender
aiService
historyService
analysisService
scheduler
queue


---

# 対象外

- HTTPレスポンス形式
- UI表示設計
- ログフォーマット
- 障害通知

---

# 期待効果

1  
失敗処理統一

2  
retry制御可能

3  
ログ分析容易

4  
Queue / Scheduler 対応

5  
障害調査容易

---

# ADR関係

前提

ADR-001  
Service返り値契約

ADR-003  
LINE送信エンジン統一

後続

ADR-006  
Scheduler配信

ADR-007  
会話履歴契約

ADR-011  
配信Queue

ADR-012  
LIFF入口

---

# 結論

栄一ツールでは

成功契約 + 失敗契約

両方を固定する。


{
success:false,
message:"",
data:null,
error:{
code:"",
retryable:false,
severity:"medium"
}
}


この契約を今後のService返却の標準とする。
