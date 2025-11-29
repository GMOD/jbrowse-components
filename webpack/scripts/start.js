// Makes the script crash on unhandled rejections instead of silently ignoring
// them. In the future, promise rejections that are not handled will terminate
// the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err
})

// Ensure environment variables are read.
require('../config/env')

const chalk = require('chalk')
const open = require('open')
const {
  choosePort,
  createCompiler,
  prepareUrls,
} = require('./react-dev-utils/WebpackDevServerUtils')
const webpack = require('webpack')
const WebpackDevServer = require('webpack-dev-server')

const paths = require('../config/paths')

// Tools like Cloud9 rely on this.
const DEFAULT_PORT = Number.parseInt(process.env.PORT, 10) || 3000
const HOST = process.env.HOST || '0.0.0.0'

if (process.env.HOST) {
  console.log(
    chalk.cyan(
      `Attempting to bind to HOST environment variable: ${chalk.yellow(
        chalk.bold(process.env.HOST),
      )}`,
    ),
  )
  console.log(
    `If this was unintentional, check that you haven't mistakenly set it in your shell.`,
  )
  console.log()
}

function openBrowser(url) {
  if (process.env.BROWSER === 'none') {
    return
  }
  open(url, { wait: false }).catch(() => {})
}

module.exports = function startWebpack(config) {
  return choosePort(HOST, DEFAULT_PORT)
    .then(port => {
      if (port == null) {
        return
      }

      const protocol = process.env.HTTPS === 'true' ? 'https' : 'http'
      const appName = require(paths.appPackageJson).name

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

      const serverConfig = {
        host: HOST,
        port,
      }
      const devServer = new WebpackDevServer(serverConfig, compiler)
      devServer.startCallback(() => {
        openBrowser(urls.localUrlForBrowser)
      })
    })
    .catch(err => {
      if (err?.message) {
        console.log(err.message)
      }
      process.exit(1)
    })
}
