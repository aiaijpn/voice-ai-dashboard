# ADR-014 保存データとAI入力コンテキストの分離

## Status

Accepted

## Date

2026-03-15

---

## 背景

ADR-011 により、会話履歴を取得して AI 応答へ反映する流れが導入された。  
その過程で、`line/handler.js` にて会話履歴を組み立てた文字列を AI に渡す構造が入った。

例:

```js
const textForAI = buildTextWithHistory(userText, history);

processMessage({
  text: textForAI,
});

この構造自体は、AI に会話文脈を与える目的では有効である。
しかし同時に、processMessage() 側では受け取った text をそのまま保存処理へ流していたため、conversation_history.userMessage に本来保存すべき「ユーザーの生発言」ではなく、履歴付きの加工済みテキストが保存される状態になった。

結果として、conversation_history には以下のようなデータが入る。

【直近の会話】
User: ...
AI: ...

【今回】
User: ...

これは保存データとして不適切である。

問題

AI 用に加工した入力テキストと、保存用の元データが混線していた。

本来、AI システムでは次の 2 つは明確に分離すべきである。

保存対象となる生データ

AI 呼び出し専用の加工済みコンテキスト

この分離がないと、以下の問題が起きる。

conversation_history.userMessage が汚染される

ユーザー発話の事実記録が失われる

ログ分析・検索・集計が不正確になる

AI プロンプト改善が保存仕様に波及する

将来の DB 化や履歴再利用時に意味が壊れる

決定

保存データと AI 入力コンテキストの責務を分離する。

保存原則

conversation_history.userMessage には、必ずユーザーの生発言のみ を保存する。

すなわち保存対象は:

userMessage = userText

とする。

AI入力原則

会話履歴を付加した文字列、または OpenAI へ渡すために構築したメッセージ群は、AI 呼び出し専用の一時データ とする。

これらは保存データへ流用しない。

データの位置づけ

rawUserText = 正本データ（canonical data）

履歴付き AI 入力 = 派生データ（derived data）

今後、保存処理は正本データのみを対象とし、派生データを保存しない。

修正方針

最小差分の修正として、line/handler.js では processMessage() に保存対象としての userText を渡す。

修正前
text: textForAI
修正後
text: userText

これにより、保存処理へ流れる text は履歴付きテキストではなく、生のユーザー入力に戻る。

正しい責務構造
LINE
  ↓
handler
  ↓
userText（生発言）
  ↓
processMessage
  ↓
保存
conversation_history

AI の履歴反映は、保存処理とは別責務として扱う。

将来的には、AI 用の履歴構築責務は handler ではなく messageService 側へ集約する。

目的

この ADR の目的は、以下を恒久的に防止することである。

履歴付きテキストの保存

AI プロンプトの保存データへの混入

会話ログ汚染

分析不能な履歴データの蓄積

AI 入力改善と保存仕様の不要な結合

影響範囲
最小実装影響

line/handler.js

設計影響

services/messageService/index.js

将来の AI 入力構築処理

会話履歴取得と OpenAI メッセージ生成の責務配置

テスト方針
確認項目

conversation_history.userMessage に履歴展開文が保存されないこと

conversation_history.userMessage にユーザーの生発言のみが保存されること

AI 応答が会話文脈を保持したまま継続できること

logs や他保存処理の意味が崩れていないこと

期待例

ユーザー入力:

スーツの色は？

期待される保存データ:

userMessage: スーツの色は？
aiReply: 赤いスーツがおすすめです

履歴付きの補助文や 【直近の会話】 などが保存されてはならない。

依存関係

ADR-007 保存契約固定

ADR-008 conversation_history 保存

ADR-011 履歴取得

ADR-014 保存データとAI入力コンテキストの分離

ADR-014 は、ADR-007 の保存契約を守るための補強 ADR であり、ADR-011 により発生した責務混線を是正する位置づけである。

今後の方針

次段階では、AI 履歴構築の責務を handler から messageService へ移し、会話文脈生成をアプリケーションサービス層へ集約する。

この整理は次の ADR で扱う。

ADR-015 AI履歴構築責務の messageService 集約

補足

本 ADR は単なる一時的バグ修正ではない。
保存データの意味を守り、AI 実行コンテキストとの責務を分離するための基盤 ADR である。

保存対象は観測事実であり、AI 入力は推論用の加工物である。
この原則を今後も維持する。
