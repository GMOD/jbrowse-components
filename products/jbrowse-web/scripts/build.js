process.env.NODE_ENV = 'production'

const webpack = require('webpack')

const configFactory = require('../../../webpack/config/webpack.config')
const build = require('../../../webpack/scripts/build')

const config = configFactory('production')
config.plugins.push(
  new webpack.DefinePlugin({
    // Global @jbrowse/mobx-state-tree configuration.
    // Force type checking in production for easier debugging:
    // xref https://github.com/GMOD/jbrowse-components/pull/1575
    'process.env.ENABLE_TYPE_CHECK': '"true"',
  }),
)
config.output.publicPath = 'auto'

// eslint-disable-next-line @typescript-eslint/no-floating-promises
build(config)
