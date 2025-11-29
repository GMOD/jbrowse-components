/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const open = require('open')

function openBrowser(url) {
  if (process.env.BROWSER === 'none') {
    return false
  }

  const browser = process.env.BROWSER || undefined
  const args = process.env.BROWSER_ARGS
    ? process.env.BROWSER_ARGS.split(' ')
    : []

  const options = {
    app: browser && args.length > 0 ? [browser, ...args] : browser,
    wait: false,
    url: true,
  }

  try {
    open(url, options).catch(() => {})
    return true
  } catch (err) {
    return false
  }
}

module.exports = openBrowser
