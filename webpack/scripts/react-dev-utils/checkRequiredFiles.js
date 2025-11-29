/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const fs = require('fs')
const path = require('path')
const chalk = require('chalk')

function checkRequiredFiles(files) {
  let currentFilePath
  try {
    files.forEach(filePath => {
      currentFilePath = filePath
      fs.accessSync(filePath, fs.F_OK)
    })
    return true
  } catch (err) {
    const dirName = path.dirname(currentFilePath)
    const fileName = path.basename(currentFilePath)
    console.log(chalk.red('Could not find a required file.'))
    console.log(chalk.red('  Name: ') + chalk.cyan(fileName))
    console.log(chalk.red('  Searched in: ') + chalk.cyan(dirName))
    return false
  }
}

module.exports = checkRequiredFiles
