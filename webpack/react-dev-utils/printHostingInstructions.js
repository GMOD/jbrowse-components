/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const chalk = require('chalk')

function printHostingInstructions(
  _appPackage,
  publicUrl,
  publicPath,
  buildFolder,
) {
  console.log(
    `The project was built assuming it is hosted at ${chalk.green(
      publicUrl || publicPath || 'the server root',
    )}.`,
  )
  console.log(
    `You can control this with the ${chalk.green(
      'homepage',
    )} field in your ${chalk.cyan('package.json')}.`,
  )
  console.log()
  console.log(`The ${chalk.cyan(buildFolder)} folder is ready to be deployed.`)
  console.log()
  console.log('You may serve it with a static server:')
  console.log()
  console.log(`  ${chalk.cyan('npx serve')} -s ${buildFolder}`)
  console.log()
}

module.exports = printHostingInstructions
