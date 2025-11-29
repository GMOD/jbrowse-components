const webpack = require('webpack')
const WebpackDevServer = require('webpack-dev-server')

module.exports = function startWebpack(config) {
  const compiler = webpack(config)
  const server = new WebpackDevServer(config.devServer, compiler)
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  server.start()
}
