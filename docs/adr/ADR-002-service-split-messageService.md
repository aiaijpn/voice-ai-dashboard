# ADR-002
messageService.js の分割（会話中核の責務分離）

## ステータス

採用

## 日付

2026-03-09

---

## 背景

現在の `services/messageService.js` は、
LINE会話処理の中核として複数責務を同時に持っている。

- メッセージ受信後の処理制御
- 会話履歴取得
- AI応答生成
- 広告挿入
- 最終返信文生成

この結果、以下の問題が発生している。

- ファイル行数の増大
- 可読性の低下
- 改修時の影響範囲が不明確
- バグ混入リスクの増大

実測では `services/messageService.js` は約243行であり、
今後の会話機能拡張を考えると、
単一ファイルのまま維持するのは危険と判断した。

なお、将来的に LIFF モジュールや定期配信モジュールの追加を予定しているが、
それらは本ADRの対象外とする。
本ADRでは、会話中核の責務分離のみに限定して決定する。

---

## 決定

`messageService.js` を責務別モジュールへ分割する。

分割後の構成は以下とする。

```text
services/
├─ messageService.js
├─ conversationService.js
├─ historyService.js
├─ adService.js
└─ responseBuilder.js


## 実装結果 (ADR-002B)

messageService は以下の構造へ分割された。

services/messageService/

index.js  
AI会話処理のオーケストレーション

promptBuilder.js  
systemPrompt生成  
Operatorプロフィール適用

openaiClient.js  
OpenAI Responses API呼び出し

responseParser.js  
OpenAIレスポンス解析  
reply_text / summary / category / urgency_score抽出

logSavers.js  
Usageログ保存  
VoiceLog保存

### 設計意図

index.js を司令塔として  
AI処理の責務をモジュール化した。

これにより

・可読性向上  
・テスト容易性  
・機能追加時の安全性  

を確保する。

### 旧構造

services/messageService.js

### 新構造

services/messageService/index.js
