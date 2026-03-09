# server.js 分割リファクタ

## 対象
server.js

## 状態（開始前）
行数：328

## 問題
server.js に以下が混在している

- Express初期化
- route設定
- middleware
- LINE webhook
- logger
- config

責務が集中している。

## 作業計画

分割方針

server.js
↓
app.js
routes/
config/

具体案

server.js
  起動のみ

app.js
  express設定

routes/
  ルーティング

config/
  環境設定

## 作業日
2026-03-09

## 作業結果
server.js 行数

328 → 80

分割結果

server.js
app.js
routes/*
config/*

## 評価
責務分離成功
今後の拡張が容易

