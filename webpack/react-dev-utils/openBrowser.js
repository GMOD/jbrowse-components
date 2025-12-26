/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

const open = require('open');

function openBrowser(url) {
  // Honor BROWSER environment variable
  const browser = process.env.BROWSER;
  if (browser && browser.toLowerCase() === 'none') {
    return false;
  }

  try {
    open(url, { app: browser || undefined, wait: false, url: true }).catch(() => {});
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = openBrowser;
