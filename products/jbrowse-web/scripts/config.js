const webpack = require('webpack')
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')

module.exports = function (config) {
  config.plugins.push(
    new NodePolyfillPlugin({
      excludeAliases: ['console'],
    }),
    new webpack.DefinePlugin({
      // Global mobx-state-tree configuration.
      // Force type checking in production for easier debugging:
      // xref https://github.com/GMOD/jbrowse-components/pull/1575
      'process.env.ENABLE_TYPE_CHECK': '"true"',
    }),
  )

  config.output.publicPath = 'auto'
  return config
}
