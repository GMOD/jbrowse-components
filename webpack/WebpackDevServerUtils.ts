import chalk from 'chalk'
import webpack from 'webpack'

function formatMessage(message: string | { message: string }) {
  if (typeof message === 'string') {
    return message
  }
  if ('message' in message) {
    return message.message
  }
  return String(message)
}

export function createCompiler({ config }: { config: webpack.Configuration }) {
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

  compiler.hooks.done.tap('done', (stats: webpack.Stats) => {
    const statsData = stats.toJson({ all: false, warnings: true, errors: true })
    const errors = (
      (statsData.errors ?? []) as (string | { message: string })[]
    ).map(formatMessage)
    const warnings = (
      (statsData.warnings ?? []) as (string | { message: string })[]
    ).map(formatMessage)

    if (!errors.length && !warnings.length) {
      console.log(chalk.green('Compiled successfully!'))
    }
    if (errors.length) {
      console.log(chalk.red('Failed to compile.\n'))
      console.log(errors.join('\n\n'))
      return
    }
    if (warnings.length) {
      console.log(chalk.yellow('Compiled with warnings.\n'))
      console.log(warnings.join('\n\n'))
    }
  })

  return compiler
}
