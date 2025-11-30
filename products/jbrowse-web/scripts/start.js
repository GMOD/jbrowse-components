process.env.NODE_ENV = 'development'

const webpack = require('webpack')

const configFactory = require('../../../webpack/config/webpack.config')
const startServer = require('../../../webpack/scripts/start')

const config = configFactory('development')
config.plugins.push(
  new webpack.DefinePlugin({
    'process.env.ENABLE_TYPE_CHECK': '"true"',
  }),
)
config.output.publicPath = 'auto'

startServer(config)
