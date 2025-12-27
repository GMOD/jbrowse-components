import chalk from 'chalk'
import detect from 'detect-port-alt'

import formatWebpackMessages from './formatWebpackMessages.js'

export function prepareUrls(protocol, host, port, pathname = '/') {
  const prettyHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host
  return {
    localUrlForTerminal: `${protocol}://${prettyHost}:${chalk.bold(port)}${pathname}`,
    localUrlForBrowser: `${protocol}://${prettyHost}:${port}${pathname}`,
  }
}

export function createCompiler({ appName, config, urls, webpack }) {
  let compiler
  try {
    compiler = webpack(config)
  } catch (err) {
    console.log(chalk.red('Failed to compile.'))
    console.log(err.message || err)
    process.exit(1)
  }

  compiler.hooks.invalid.tap('invalid', () => {
    console.log('Compiling...')
  })

  let isFirstCompile = true

  compiler.hooks.done.tap('done', stats => {
    const statsData = stats.toJson({ all: false, warnings: true, errors: true })
    const messages = formatWebpackMessages(statsData)
    const isSuccessful = !messages.errors.length && !messages.warnings.length

    if (isSuccessful) {
      console.log(chalk.green('Compiled successfully!'))
    }
    if (isSuccessful && isFirstCompile) {
      console.log()
      console.log(
        `You can view ${chalk.bold(appName)} at ${urls.localUrlForTerminal}`,
      )
      console.log()
    }
    isFirstCompile = false

    if (messages.errors.length) {
      console.log(chalk.red('Failed to compile.\n'))
      console.log(messages.errors.join('\n\n'))
      return
    }

    if (messages.warnings.length) {
      console.log(chalk.yellow('Compiled with warnings.\n'))
      console.log(messages.warnings.join('\n\n'))
    }
  })

  return compiler
}

export function choosePort(host, defaultPort) {
  return detect(defaultPort, host).then(port => {
    if (port !== defaultPort) {
      console.log(chalk.yellow(`Port ${defaultPort} in use, using ${port}`))
    }
    return port
  })
}
