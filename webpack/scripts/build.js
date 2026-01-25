import fs from 'fs'
import path from 'path'

import browserslist from 'browserslist'
import chalk from 'chalk'
import webpack from 'webpack'

import paths from '../config/paths.js'
import {
  measureFileSizesBeforeBuild,
  printFileSizesAfterBuild,
} from '../react-dev-utils/FileSizeReporter.js'
import formatWebpackMessages from '../react-dev-utils/formatWebpackMessages.js'

process.on('unhandledRejection', err => {
  throw err
})

process.env.NODE_ENV = 'production'

// Check required files exist
for (const filePath of [paths.appHtml, paths.appIndexJs]) {
  if (!fs.existsSync(filePath)) {
    console.error(`Required file not found: ${filePath}`)
    process.exit(1)
  }
}

// Check browserslist is configured
if (browserslist.loadConfig({ path: paths.appPath }) == null) {
  console.error(
    chalk.red(
      'You must specify targeted browsers in package.json browserslist.',
    ),
  )
  process.exit(1)
}

const writeStatsJson = process.argv.includes('--stats')

export default function buildWebpack(config) {
  return measureFileSizesBeforeBuild(paths.appBuild)
    .then(previousFileSizes => {
      fs.rmSync(paths.appBuild, { recursive: true, force: true })
      fs.cpSync(paths.appPublic, paths.appBuild, {
        recursive: true,
        dereference: true,
        filter: file => file !== paths.appHtml,
      })
      return build(config, previousFileSizes)
    })
    .then(
      ({ stats, previousFileSizes, warnings }) => {
        if (warnings.length) {
          console.log(chalk.yellow('Compiled with warnings.\n'))
          console.log(warnings.join('\n\n'))
        } else {
          console.log(chalk.green('Compiled successfully.\n'))
        }

        console.log('File sizes:\n')
        printFileSizesAfterBuild(stats, previousFileSizes, paths.appBuild)
        console.log()

        const buildFolder = path.relative(process.cwd(), paths.appBuild)
        console.log(
          `The ${chalk.cyan(buildFolder)} folder is ready to be deployed.`,
        )
        console.log()
      },
      err => {
        console.log(chalk.red('Failed to compile.\n'))
        console.log(err?.message || err)
        process.exit(1)
      },
    )
    .catch(err => {
      if (err?.message) {
        console.log(err.message)
      }
      process.exit(1)
    })
}

function build(config, previousFileSizes) {
  console.log('Creating an optimized production build...')

  const compiler = webpack(config)
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      let messages
      if (err) {
        if (!err.message) {
          reject(err)
          return
        }
        messages = formatWebpackMessages({
          errors: [err.message],
          warnings: [],
        })
      } else {
        messages = formatWebpackMessages(
          stats.toJson({ all: false, warnings: true, errors: true }),
        )
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
          `${paths.appBuild}/bundle-stats.json`,
          JSON.stringify(stats.toJson()),
        )
      }

      resolve({ stats, previousFileSizes, warnings: messages.warnings })
    })
  })
}
