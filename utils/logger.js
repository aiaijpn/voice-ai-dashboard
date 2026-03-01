'use strict';

// logger.js - DEBUG logging wrapper
const isDebug = process.env.DEBUG === 'true';

const log = (...args) => {
  if (isDebug) console.log(...args);
};

module.exports = { log };
