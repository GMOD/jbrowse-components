process.on('unhandledRejection', err => {
  throw err
})

const fs = require('fs')
const chalk = require('chalk')
const webpack = require('webpack')
const { printFileSizesAfterBuild } = require('./react-dev-utils/FileSizeReporter')

const argv = process.argv.slice(2)
const writeStatsJson = argv.includes('--stats')

module.exports = function buildWebpack(config) {
  const { paths } = require('../config/webpack.config')

  for (const filePath of [paths.appHtml, paths.appIndexJs]) {
    if (!fs.existsSync(filePath)) {
      console.log(chalk.red(`Could not find required file: ${filePath}`))
      process.exit(1)
    }
  }

  fs.rmSync(paths.appBuild, { recursive: true, force: true })
  fs.cpSync(paths.appPublic, paths.appBuild, {
    recursive: true,
    dereference: true,
    filter: file => file !== paths.appHtml,
  })

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
        console.log(chalk.red('Failed to compile.\n'))
        console.log(info.errors.map(e => e.message || e).join('\n\n'))
        process.exit(1)
      }

      if (info.warnings.length) {
        console.log(chalk.yellow('Compiled with warnings.\n'))
        console.log(info.warnings.map(w => w.message || w).join('\n\n'))
      } else {
        console.log(chalk.green('Compiled successfully.\n'))
      }

      console.log('File sizes:\n')
      printFileSizesAfterBuild(stats, paths.appBuild)
      console.log()

      if (writeStatsJson) {
        fs.writeFileSync(
          `${paths.appBuild}/bundle-stats.json`,
          JSON.stringify(stats.toJson()),
        )
      }

      resolve()
    })
  }).catch(err => {
    if (err?.message) {
      console.log(err.message)
    }
    process.exit(1)
  })
}
