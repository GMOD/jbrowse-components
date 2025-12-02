process.env.NODE_ENV = 'development'

const path = require('path')
const webpack = require('webpack')
const configFactory = require('../../../webpack/config/webpack.config')
const startServer = require('../../../webpack/scripts/start')

const config = configFactory('development')
config.plugins.push(
  new webpack.DefinePlugin({
    'process.env.ENABLE_TYPE_CHECK': '"true"',
  }),
)
config.target = 'electron-renderer'
config.resolve.aliasFields = []
config.resolve.mainFields = ['module', 'main']
config.resolve.alias = {
  ...config.resolve.alias,
  'generic-filehandle2': path.resolve(
    __dirname,
    '../../../node_modules/generic-filehandle2/dist/index.js',
  ),
}
config.output.publicPath = 'auto'

startServer(config)
