/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict'

const os = require('os')

const browserslist = require('browserslist')
const chalk = require('chalk')

function checkBrowsers(dir) {
  const current = browserslist.loadConfig({ path: dir })
  if (current != null) {
    return Promise.resolve(current)
  }

  return Promise.reject(
    new Error(
      `${
        chalk.red('You must specify targeted browsers.') + os.EOL
      }Please add a ${chalk.underline(
        'browserslist',
      )} key to your ${chalk.bold('package.json')}.`,
    ),
  )
}

module.exports = { checkBrowsers }
