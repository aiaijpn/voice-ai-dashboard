# Documentation Index

## 目的

栄一ツールのドキュメントを  
一覧で把握できるようにする。

---

# Architecture

システムの全体構造。


architecture_overview.md
system_architecture.md


---

# Module Design

モジュール構造。


module_design.md


---

# Persona System

ユーザーペルソナ設計。


persona_system.md


---

# Ad Module

広告挿入ロジック。


ad_module.md


---

# Conversation Engine

会話処理の中核。


conversation_engine.md


---

# Development

開発ルールと手順。


coding_rules.md
development_workflow.md


---

# Git

Git操作方法。


git_command.md


---

# Alignment

ドキュメントとソースコードの整合チェック。


source_alignment.md


---

# 推奨閲覧順

新しく参加する開発者は  
以下の順で読む。


1 architecture_overview.md
2 system_architecture.md
3 module_design.md
4 conversation_engine.md


---

# 補足

ドキュメント更新時は  
この index も更新する。

---

# ADR一覧

このプロジェクトでは、重要な設計判断を  
ADR（Architecture Decision Record）として記録する。

保存場所


docs/adr/


一覧

ADR-001  
Service返り値契約統一  

ADR-002  
messageService 分割  

ADR-002B  
messageService 内部モジュール化  

ADR-003  
LINE送信エンジン統一  

ADR-007  
保存契約固定  

ADR-008  
conversation_history 保存  

ADR-009  
admin_message 保存  

ADR-010  
ai_reply 保存  

ADR-011  
履歴取得（conversation history fetch）  

ADR-012  
ファイル分割ルール（200行ルール）
補足（開発者向け）

ADR-012 により
services/messageService は責務単位で分割された。

主な構造

services/messageService

index.js              (司令塔)
promptBuilder.js
openaiClient.js
responseParser.js
classifyMessage.js
buildReply.js
logSavers.js
handleConversation.js

index.js は **処理オーケストレーションのみ担当する。


---

### この更新の意味
- **ADR003〜ADR012 を正式反映**
- messageService分割の実態を記録
- 新規開発者が迷わない

---
