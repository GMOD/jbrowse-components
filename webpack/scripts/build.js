// Makes the script crash on unhandled rejections instead of silently ignoring
// them. In the future, promise rejections that are not handled will terminate
// the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err
})

// Ensure environment variables are read.
require('../config/env')

const fs = require('fs')

const chalk = require('chalk')
const FileSizeReporter = require('./react-dev-utils/FileSizeReporter')
const checkRequiredFiles = require('./react-dev-utils/checkRequiredFiles')
const webpack = require('webpack')

const paths = require('../config/paths')

const measureFileSizesBeforeBuild = FileSizeReporter.measureFileSizesBeforeBuild
const printFileSizesAfterBuild = FileSizeReporter.printFileSizesAfterBuild

// These sizes are pretty large. We'll warn for bundles exceeding them.
const WARN_AFTER_BUNDLE_GZIP_SIZE = 512 * 1024
const WARN_AFTER_CHUNK_GZIP_SIZE = 1024 * 1024

// Warn and crash if required files are missing
if (!checkRequiredFiles([paths.appHtml, paths.appIndexJs])) {
  process.exit(1)
}

const argv = process.argv.slice(2)
const writeStatsJson = argv.includes('--stats')

module.exports = function buildWebpack(config) {
  return measureFileSizesBeforeBuild(paths.appBuild)
    .then(previousFileSizes => {
      // Remove all content but keep the directory so that
      // if you're in it, you don't end up in Trash
      fs.rmSync(paths.appBuild, { recursive: true, force: true })
      // Merge with the public folder
      copyPublicFolder()
      // Start the webpack build
      return build(previousFileSizes)
    })
    .then(
      ({ stats, previousFileSizes, warnings }) => {
        if (warnings.length) {
          console.log(chalk.yellow('Compiled with warnings.\n'))
          console.log(warnings.join('\n\n'))
        } else {
          console.log(chalk.green('Compiled successfully.\n'))
        }

        console.log('File sizes after gzip:\n')
        printFileSizesAfterBuild(
          stats,
          previousFileSizes,
          paths.appBuild,
          WARN_AFTER_BUNDLE_GZIP_SIZE,
          WARN_AFTER_CHUNK_GZIP_SIZE,
        )
        console.log()
      },
      err => {
        console.log(chalk.red('Failed to compile.\n'))
        console.log(err.message || err)
        process.exit(1)
      },
    )
    .catch(err => {
      if (err?.message) {
        console.log(err.message)
      }
      process.exit(1)
    })

  function build(previousFileSizes) {
    console.log('Creating an optimized production build...')

    const compiler = webpack(config)
    return new Promise((resolve, reject) => {
      compiler.run((err, stats) => {
        if (err) {
          reject(err)
          return
        }

        const info = stats.toJson({ all: false, warnings: true, errors: true })

        if (info.errors.length) {
          reject(new Error(info.errors.map(e => e.message || e).join('\n\n')))
          return
        }

        if (writeStatsJson) {
          fs.writeFileSync(
            `${paths.appBuild}/bundle-stats.json`,
            JSON.stringify(stats.toJson()),
          )
        }

        resolve({
          stats,
          previousFileSizes,
          warnings: info.warnings.map(w => w.message || w),
        })
      })
    })
  }

  function copyPublicFolder() {
    fs.cpSync(paths.appPublic, paths.appBuild, {
      recursive: true,
      dereference: true,
      filter: file => file !== paths.appHtml,
    })
  }
}
