process.env.NODE_ENV = 'production'

const path = require('path')
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

build(config)
