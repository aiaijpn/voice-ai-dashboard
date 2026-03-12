# システム構造

LINE
 ↓
handler
 ↓
messageService/index.js
 ↓
 ├ promptBuilder
 ├ openaiClient
 ├ responseParser
 └ logSavers
 ↓
OpenAI
