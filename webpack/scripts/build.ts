import fs from 'fs'
import path from 'path'

import browserslist from 'browserslist'
import chalk from 'chalk'
import webpack from 'webpack'

import { printFileSizesAfterBuild } from '../FileSizeReporter.ts'
import { appBuild, appHtml, appIndexJs, appPublic } from '../config/paths.ts'

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

export default function buildWebpack(
  config: webpack.Configuration,
): Promise<void> {
  fs.rmSync(appBuild, { recursive: true, force: true })
  fs.cpSync(appPublic, appBuild, {
    recursive: true,
    dereference: true,
    filter: file => {
      if (file === appHtml) {
        return false
      }
      try {
        fs.statSync(file)
        return true
      } catch {
        return false
      }
    },
  })

  console.log('Creating an optimized production build...')
  const compiler = webpack(config)
  return new Promise(resolve => {
    compiler.run((err, stats) => {
      if (err || !stats) {
        console.log(chalk.red('Failed to compile.\n'))
        console.log(err?.message || err)
        process.exit(1)
      } else if (stats.hasErrors()) {
        console.log(chalk.red('Failed to compile.\n'))
        console.log(stats.toString({ all: false, errors: true }))
        process.exit(1)
      } else {
        if (stats.hasWarnings()) {
          console.log(chalk.yellow('Compiled with warnings.\n'))
          console.log(stats.toString({ all: false, warnings: true }))
        } else {
          console.log(chalk.green('Compiled successfully.\n'))
        }

        if (writeStatsJson) {
          fs.writeFileSync(
            `${appBuild}/bundle-stats.json`,
            JSON.stringify(stats.toJson()),
          )
        }

        console.log('\nFile sizes:\n')
        printFileSizesAfterBuild(stats, appBuild)
        const buildFolder = path.relative(process.cwd(), appBuild)
        console.log(
          `\nThe ${chalk.cyan(buildFolder)} folder is ready to be deployed.\n`,
        )
        resolve()
      }
    })
  })
}
