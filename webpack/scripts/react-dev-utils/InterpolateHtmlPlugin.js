/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

function escapeStringRegexp(string) {
  return string.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d')
}

class InterpolateHtmlPlugin {
  constructor(htmlWebpackPlugin, replacements) {
    this.htmlWebpackPlugin = htmlWebpackPlugin
    this.replacements = replacements
  }

  apply(compiler) {
    compiler.hooks.compilation.tap('InterpolateHtmlPlugin', compilation => {
      this.htmlWebpackPlugin
        .getHooks(compilation)
        .afterTemplateExecution.tap('InterpolateHtmlPlugin', data => {
          Object.keys(this.replacements).forEach(key => {
            const value = this.replacements[key]
            data.html = data.html.replace(
              new RegExp('%' + escapeStringRegexp(key) + '%', 'g'),
              value,
            )
          })
        })
    })
  }
}

module.exports = InterpolateHtmlPlugin
