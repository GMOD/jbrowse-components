#!/usr/bin/env node

// Hook into require to make CSS imports a no-op
const Module = require('module')
const originalRequire = Module.prototype.require

// Override the require function to intercept CSS imports
Module.prototype.require = function (path) {
  // If the path ends with .css, return an empty object
  if (path.endsWith('.css')) {
    return {}
  }
  // Otherwise, use the original require
  return Reflect.apply(originalRequire, this, arguments)
}

require('./index.js')
