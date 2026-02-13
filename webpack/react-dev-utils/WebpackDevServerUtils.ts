import chalk from 'chalk'
// @ts-expect-error no types available
import detect from 'detect-port-alt'
import type webpack from 'webpack'

import formatWebpackMessages from './formatWebpackMessages.ts'

export function prepareUrls(
  protocol: string,
  host: string,
  port: number,
  pathname = '/',
) {
  const prettyHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host
  return {
    localUrlForTerminal: `${protocol}://${prettyHost}:${chalk.bold(port)}${pathname}`,
    localUrlForBrowser: `${protocol}://${prettyHost}:${port}${pathname}`,
  }
}

export function createCompiler({
  appName,
  config,
  urls,
  webpack,
}: {
  appName: string
  config: webpack.Configuration
  urls: { localUrlForTerminal: string; localUrlForBrowser: string }
  webpack: typeof import('webpack')
}) {
  let compiler: webpack.Compiler
  try {
    compiler = webpack(config)
  } catch (e) {
    console.log(chalk.red('Failed to compile.'))
    console.log(e instanceof Error ? e.message : e)
    process.exit(1)
  }

  compiler.hooks.invalid.tap('invalid', () => {
    console.log('Compiling...')
  })

  let isFirstCompile = true

  compiler.hooks.done.tap('done', (stats: webpack.Stats) => {
    const statsData = stats.toJson({ all: false, warnings: true, errors: true })
    const messages = formatWebpackMessages(statsData as { errors: (string | { message: string })[]; warnings: (string | { message: string })[] })
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

export function choosePort(host: string, defaultPort: number) {
  return (detect as (port: number, host: string) => Promise<number>)(defaultPort, host).then((port: number) => {
    if (port !== defaultPort) {
      console.log(chalk.yellow(`Port ${defaultPort} in use, using ${port}`))
    }
    return port
  })
}
