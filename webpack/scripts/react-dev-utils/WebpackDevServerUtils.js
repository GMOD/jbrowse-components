/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict'

const address = require('address')
const chalk = require('chalk')
const detect = require('detect-port-alt')

const isInteractive = process.stdout.isTTY

function prepareUrls(protocol, host, port, pathname = '/') {
  const formatUrl = hostname => `${protocol}://${hostname}:${port}${pathname}`
  const prettyPrintUrl = hostname =>
    `${protocol}://${hostname}:${chalk.bold(port)}${pathname}`

  const isUnspecifiedHost = host === '0.0.0.0' || host === '::'
  let prettyHost, lanUrlForTerminal
  if (isUnspecifiedHost) {
    prettyHost = 'localhost'
    try {
      const lanIp = address.ip()
      if (
        lanIp &&
        /^10[.]|^172[.](1[6-9]|2[0-9]|3[0-1])[.]|^192[.]168[.]/.test(lanIp)
      ) {
        lanUrlForTerminal = prettyPrintUrl(lanIp)
      }
    } catch (_e) {
      // ignored
    }
  } else {
    prettyHost = host
  }
  return {
    lanUrlForTerminal,
    localUrlForTerminal: prettyPrintUrl(prettyHost),
    localUrlForBrowser: formatUrl(prettyHost),
  }
}

function printInstructions(appName, urls) {
  console.log()
  console.log(`You can now view ${chalk.bold(appName)} in the browser.`)
  console.log()

  if (urls.lanUrlForTerminal) {
    console.log(
      `  ${chalk.bold('Local:')}            ${urls.localUrlForTerminal}`,
    )
    console.log(
      `  ${chalk.bold('On Your Network:')}  ${urls.lanUrlForTerminal}`,
    )
  } else {
    console.log(`  ${urls.localUrlForTerminal}`)
  }

  console.log()
  console.log('Note that the development build is not optimized.')
  console.log(
    `To create a production build, use ${chalk.cyan('yarn build')}.`,
  )
  console.log()
}

function createCompiler({ appName, config, urls, webpack }) {
  let compiler
  try {
    compiler = webpack(config)
  } catch (err) {
    console.log(chalk.red('Failed to compile.'))
    console.log()
    console.log(err.message || err)
    console.log()
    process.exit(1)
  }

  compiler.hooks.invalid.tap('invalid', () => {
    console.log('Compiling...')
  })

  let isFirstCompile = true

  compiler.hooks.done.tap('done', async stats => {
    const info = stats.toJson({
      all: false,
      warnings: true,
      errors: true,
    })

    const isSuccessful = !info.errors.length && !info.warnings.length
    if (isSuccessful) {
      console.log(chalk.green('Compiled successfully!'))
    }
    if (isSuccessful && (isInteractive || isFirstCompile)) {
      printInstructions(appName, urls)
    }
    isFirstCompile = false

    if (info.errors.length) {
      console.log(chalk.red('Failed to compile.\n'))
      console.log(info.errors.map(e => e.message || e).join('\n\n'))
      return
    }

    if (info.warnings.length) {
      console.log(chalk.yellow('Compiled with warnings.\n'))
      console.log(info.warnings.map(w => w.message || w).join('\n\n'))
    }
  })

  return compiler
}

function choosePort(host, defaultPort) {
  return detect(defaultPort, host).then(
    port => {
      if (port === defaultPort) {
        return port
      }
      const message =
        process.platform !== 'win32' && defaultPort < 1024
          ? `Admin permissions are required to run a server on a port below 1024.`
          : `Something is already running on port ${defaultPort}.`
      console.log(chalk.yellow(message))
      console.log(`Using port ${port} instead.\n`)
      return port
    },
    err => {
      throw new Error(
        chalk.red(`Could not find an open port at ${chalk.bold(host)}.`) +
          '\n' +
          ('Network error message: ' + err.message || err) +
          '\n',
      )
    },
  )
}

module.exports = {
  choosePort,
  createCompiler,
  prepareUrls,
}
