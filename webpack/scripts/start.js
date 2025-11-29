const webpack = require('webpack')
const WebpackDevServer = require('webpack-dev-server')

module.exports = function startWebpack(config) {
  const compiler = webpack(config)
  const server = new WebpackDevServer(config.devServer, compiler)
  server.start()
}
