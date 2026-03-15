ADR-012

ファイル分割ルール（200行ルール）

Status

Accepted

2026-03-15

Context

栄一ツールの開発では、機能追加に伴って単一ファイルが肥大化しやすい。
特に以下のような中核ファイルは、責務が集まりやすく、可読性と保守性を下げやすい。

server.js

services/messageService/index.js

line/handler.js

sheet/saver.js

repositories/conversationRepository.js

ファイル肥大化によって、次の問題が起きる。

読みづらい

修正影響範囲が見えにくい

バグ原因の切り分けが難しい

AI補助開発で修正精度が落ちる

小さな変更でも大きな事故になりやすい

栄一ツールでは、今後もAI会話、履歴保存、管理メッセージ、外部I/O、運用機能の追加が続く。
そのため、ファイル分割の基準を明文化しておく必要がある。

Decision

今後、栄一ツールでは 200行ルール を採用する。

基本原則

1つのファイルは 200行以内を原則とする。

200行を超えた場合は、機能単位・責務単位で分割する。

Rule
行数基準

0〜150行: 安全

151〜200行: 分割検討

201行以上: 分割必須

分割の基本方針

分割は、単純な行数削減ではなく、責務分離を目的とする。

優先する分割単位は以下。

入口処理

例: route, handler, event routing

業務ロジック

例: message processing, history save, classification

外部I/O

例: Google Sheets, DB, API, Queue

AI処理

例: prompt build, OpenAI call, response parse

共通処理

例: logger, service response, validator

Splitting Criteria

以下のいずれかに該当したら分割対象とする。

1. 行数超過

200行を超えた

2. 責務混在

1ファイル内に複数の役割が混在している

3. 外部I/O混在

業務ロジックと外部接続処理が同居している

4. AI処理混在

prompt生成、API呼び出し、response parse が同居している

5. 修正事故率上昇

小修正でも複数箇所へ影響する状態になっている

Standard Structure

標準的な分割構造は以下とする。

services/
  messageService/
    index.js
    openaiClient.js
    promptBuilder.js
    responseParser.js
    classifyMessage.js
    buildReply.js
    handleConversation.js
    logSavers.js

repositories/
  conversationRepository.js
  sheetRepository.js

sheet/
  saver.js

line/
  handler.js

utils/
  logger.js
  serviceResponse.js
Initial Targets

ADR-012適用の初期対象として、まず以下の2ファイルを優先する。

1. services/messageService/index.js

理由:

会話処理の中核

今後の機能追加が集中する

既に分割受け皿が存在するため、安全に整理しやすい

2. server.js

理由:

エントリーポイントとして肥大化しやすい

route / middleware / boot / env確認の責務分離が必要

ただし起動影響が大きいため、messageService/index.js の後に着手する

Implementation Order

ADR-012の実装順は以下とする。

services/messageService/index.js

server.js

line/handler.js

sheet/saver.js

repositories/conversationRepository.js

この順番にする理由は、中核ロジックを先に整理し、入口分割は後にする方が事故率が低いためである。

Consequences
メリット

可読性向上

責務分離の明確化

修正影響範囲の局所化

バグ切り分けの容易化

AI補助開発の精度向上

将来機能追加の安全性向上

デメリット

ファイル数が増える

import / require の管理が増える

初期整理の手間がかかる

ただし、栄一ツールの今後の拡張性と安全性を考えると、メリットが大きく上回る。

Non-Goals

ADR-012は、以下を目的としない。

すべてのファイルを一律に細分化すること

100行以下へ過剰分割すること

ロジックの全面刷新

ADR-001〜ADR-011 の契約変更

つまり、ADR-012は 構造整理のルール化 であり、既存契約を壊さずに保守性を上げるための判断である。

Relationship to Existing ADRs

ADR-012は以下の既存ADRと整合する。

ADR-001 Service返り値契約統一

ADR-002 messageService 分割

ADR-003 LINE送信エンジン統一

ADR-007 保存契約固定

ADR-008 conversation_history 保存

ADR-009 admin_message 保存

ADR-010 ai_reply 保存

ADR-011 履歴取得

ADR-012は、これらの契約や保存方針を変更せず、実装構造の整理ルールを追加するADR である。

Summary

栄一ツールでは、今後の安全な機能追加とAI補助開発の効率化のため、200行ルールによるファイル分割方針 を採用する。

200行以内を原則とする

200行超は分割必須とする

分割は責務単位で行う

最初の対象は services/messageService/index.js と server.js とする

これにより、栄一ツールの開発速度と安全性を両立させる。




ADR一覧に ADR-012 を追加。

追記内容の要点

ADR-012 ファイル分割ルール（200行ルール）

状態: Accepted

日付: 2026-03-15
