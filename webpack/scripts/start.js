import fs from 'fs'

import browserslist from 'browserslist'
import chalk from 'chalk'
import open from 'open'
import webpack from 'webpack'
// eslint-disable-next-line import/default
import WebpackDevServer from 'webpack-dev-server'

import paths from '../config/paths.js'
import {
  choosePort,
  createCompiler,
  prepareUrls,
} from '../react-dev-utils/WebpackDevServerUtils.js'

process.on('unhandledRejection', err => {
  throw err
})

process.env.NODE_ENV = 'development'

// Check browserslist is configured
if (browserslist.loadConfig({ path: paths.appPath }) == null) {
  console.error(
    chalk.red(
      'You must specify targeted browsers in package.json browserslist.',
    ),
  )
  process.exit(1)
}

const DEFAULT_PORT = Number.parseInt(process.env.PORT, 10) || 3000
const HOST = process.env.HOST || '0.0.0.0'

export default function startWebpack(config) {
  return choosePort(HOST, DEFAULT_PORT)
    .then(port => {
      if (port == null) {
        return
      }

      const protocol = process.env.HTTPS === 'true' ? 'https' : 'http'
      const appName = JSON.parse(
        fs.readFileSync(paths.appPackageJson, 'utf8'),
      ).name

      const urls = prepareUrls(
        protocol,
        HOST,
        port,
        paths.publicUrlOrPath.slice(0, -1),
      )

      const compiler = createCompiler({
        appName,
        config,
        urls,
        webpack,
      })

      const devServer = new WebpackDevServer({ host: HOST, port }, compiler)
      devServer.startCallback(() => {
        open(urls.localUrlForBrowser).catch(() => {})
      })
    })
    .catch(err => {
      if (err?.message) {
        console.log(err.message)
      }
      process.exit(1)
    })
}
