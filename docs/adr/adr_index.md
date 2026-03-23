# ADR Index

栄一ツールの Architecture Decision Record 一覧。

---

| ADR | 内容 | 状態 |
|---|---|---|
| ADR-001 | Service返り値契約統一 | Accepted |
| ADR-002 | messageService 分割 | Accepted |
| ADR-003 | LINE送信エンジン統一 | Accepted |
| ADR-004 | モジュール設計ルール | Proposed |
| ADR-005 | Repository構造導入 | Proposed |
| ADR-006 | 会話履歴設計 | Proposed |
| ADR-007 | 保存契約統一 | Accepted |
| ADR-008 | conversation_history 保存 | Accepted |
| ADR-009 | admin_message 保存 | Accepted |
| ADR-010 | ai_reply 保存 | Accepted |
| ADR-011 | Conversation History Retrieval | Proposed |
| ADR-012 | server.js ファイル分割 | Accepted |
| ADR-013 | server.js 責務整理 | Accepted |
| ADR-014 | AIプロンプトと保存データの責務分離 | Accepted |
| ADR-015 | 会話履歴管理の単一化（historyStore廃止） | Accepted |
| ADR-016 | AI入力構築責務整理（promptBuilderの明確化） | Proposed |
| ADR-017 | Version1バックアップリポジトリ作成とブランチ運用 | Accepted |

---

## ADRの目的

ADR（Architecture Decision Record）は  
システム設計における重要な技術判断を記録する。

目的

- 設計意図保存
- 将来の変更判断材料
- 開発者間の認識共有
- 技術負債の予防

---

## 栄一ツール開発原則

栄一ツールは次の順序で設計する。

契約
↓
構造
↓
実装

契約が固定されていれば  
内部実装は自由に変更できる。

契約が曖昧なまま開発すると  
小さな機能追加でもシステムは壊れる。
