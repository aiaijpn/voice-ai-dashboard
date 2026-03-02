'use strict';

// logger.js - production safe logging wrapper　　　false

const isDebug = process.env.DEBUG === 'true';

// 通常ログ（DEBUG=true の時のみ出力）
const log = (...args) => {
  if (isDebug) {
    console.log(...args);
  }
};

// エラーログ（常に出力）
const error = (...args) => {
  console.error(...args);
};

module.exports = { log, error };
