'use strict'

const fs = require('fs')

function checkRequiredFiles(files) {
  for (const filePath of files) {
    if (!fs.existsSync(filePath)) {
      console.error(`Required file not found: ${filePath}`)
      return false
    }
  }
  return true
}

module.exports = checkRequiredFiles
