/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict'

const browserslist = require('browserslist')

function checkBrowsers(dir) {
  const current = browserslist.loadConfig({ path: dir })
  if (current != null) {
    return Promise.resolve(current)
  }

  return Promise.reject(
    new Error(
      'No browserslist configuration found. ' +
        'Please add a browserslist key to your package.json.',
    ),
  )
}

module.exports = { checkBrowsers }
