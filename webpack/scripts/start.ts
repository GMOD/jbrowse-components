import fs from 'fs'

import browserslist from 'browserslist'
import chalk from 'chalk'
import open from 'open'
import webpack from 'webpack'
// eslint-disable-next-line import/default
import WebpackDevServer from 'webpack-dev-server'

import {
  choosePort,
  createCompiler,
  prepareUrls,
} from '../WebpackDevServerUtils.ts'

process.on('unhandledRejection', err => {
  throw err
})

process.env.NODE_ENV = 'development'

if (browserslist.loadConfig({ path: process.cwd() }) == null) {
  console.error(
    chalk.red(
      'You must specify targeted browsers in package.json browserslist.',
    ),
  )
  process.exit(1)
}

const DEFAULT_PORT = Number.parseInt(process.env.PORT || '3000', 10) || 3000
const HOST = process.env.HOST || '0.0.0.0'

export default function startWebpack(config: webpack.Configuration) {
  return choosePort(HOST, DEFAULT_PORT)
    .then(port => {
      if (port == null) {
        return
      }

      const protocol = process.env.HTTPS === 'true' ? 'https' : 'http'
      const appName = JSON.parse(fs.readFileSync('package.json', 'utf8')).name

      const urls = prepareUrls(protocol, HOST, port)

      const compiler = createCompiler({
        appName,
        config,
        urls,
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
