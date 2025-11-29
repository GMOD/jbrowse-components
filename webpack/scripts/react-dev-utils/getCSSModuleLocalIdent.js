/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const loaderUtils = require('loader-utils')
const path = require('path')

module.exports = function getLocalIdent(
  context,
  localIdentName,
  localName,
  options,
) {
  const fileNameOrFolder = context.resourcePath.match(
    /index\.module\.(css|scss|sass)$/,
  )
    ? '[folder]'
    : '[name]'
  const hash = loaderUtils.getHashDigest(
    path.posix.relative(context.rootContext, context.resourcePath) + localName,
    'md5',
    'base64',
    5,
  )
  const className = loaderUtils.interpolateName(
    context,
    fileNameOrFolder + '_' + localName + '__' + hash,
    options,
  )
  return className.replace('.module_', '_').replace(/\./g, '_')
}
