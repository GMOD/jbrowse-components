import fs from 'fs'
import path from 'path'

import browserslist from 'browserslist'
import chalk from 'chalk'
import webpack from 'webpack'

import { appBuild, appHtml, appIndexJs, appPublic } from '../config/paths.ts'
import { printFileSizesAfterBuild } from '../FileSizeReporter.ts'

process.on('unhandledRejection', err => {
  throw err
})

process.env.NODE_ENV = 'production'

for (const filePath of [appHtml, appIndexJs]) {
  if (!fs.existsSync(filePath)) {
    console.error(`Required file not found: ${filePath}`)
    process.exit(1)
  }
}

if (browserslist.loadConfig({ path: process.cwd() }) == null) {
  console.error(
    chalk.red(
      'You must specify targeted browsers in package.json browserslist.',
    ),
  )
  process.exit(1)
}

const writeStatsJson = process.argv.includes('--stats')

function formatMessage(message: string | { message: string }) {
  if (typeof message === 'string') {
    return message
  }
  if ('message' in message) {
    return message.message
  }
  return String(message)
}

export default function buildWebpack(config: webpack.Configuration) {
  fs.rmSync(appBuild, { recursive: true, force: true })
  fs.cpSync(appPublic, appBuild, {
    recursive: true,
    dereference: true,
    filter: file => file !== appHtml,
  })
  return (
    build(config)
      .then(
        ({ stats, warnings }) => {
          if (warnings.length) {
            console.log(chalk.yellow('Compiled with warnings.\n'))
            console.log(warnings.join('\n\n'))
          } else {
            console.log(chalk.green('Compiled successfully.\n'))
          }

          console.log('File sizes:\n')
          printFileSizesAfterBuild(stats, appBuild)
          console.log()

          const buildFolder = path.relative(process.cwd(), appBuild)
          console.log(
            `The ${chalk.cyan(buildFolder)} folder is ready to be deployed.`,
          )
          console.log()
        },
        // eslint-disable-next-line @typescript-eslint/use-unknown-in-catch-callback-variable
        err => {
          console.log(chalk.red('Failed to compile.\n'))
          console.log(err?.message || err)
          process.exit(1)
        },
      )
      // eslint-disable-next-line @typescript-eslint/use-unknown-in-catch-callback-variable
      .catch(err => {
        if (err?.message) {
          console.log(err.message)
        }
        process.exit(1)
      })
  )
}

function build(config: webpack.Configuration) {
  console.log('Creating an optimized production build...')

  const compiler = webpack(config)
  return new Promise<{ stats: webpack.Stats; warnings: string[] }>(
    (resolve, reject) => {
      compiler.run((err, stats) => {
        let messages
        if (err) {
          if (!err.message) {
            reject(err)
            return
          }
          messages = {
            errors: [err.message],
            warnings: [] as string[],
          }
        } else {
          const statsData = stats!.toJson({
            all: false,
            warnings: true,
            errors: true,
          })
          messages = {
            errors: (
              (statsData.errors || []) as (string | { message: string })[]
            ).map(formatMessage),
            warnings: (
              (statsData.warnings || []) as (string | { message: string })[]
            ).map(formatMessage),
          }
        }
        if (messages.errors.length) {
          if (messages.errors.length > 1) {
            messages.errors.length = 1
          }
          reject(new Error(messages.errors.join('\n\n')))
          return
        }

        if (writeStatsJson) {
          fs.writeFileSync(
            `${appBuild}/bundle-stats.json`,
            JSON.stringify(stats!.toJson()),
          )
        }

        resolve({ stats: stats!, warnings: messages.warnings })
      })
    },
  )
}
