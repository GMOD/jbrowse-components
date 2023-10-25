const webpack = require('webpack')

module.exports = function (config) {
  config.plugins.push(
    new webpack.DefinePlugin({
      // Global mobx-state-tree configuration. Force type checking in
      // production for easier debugging: xref
      // https://github.com/GMOD/jbrowse-components/pull/1575
      //
      // Note: these are basically 'string replaced' AT COMPILE time, so there
      // is NOT a true 'process' object in the source code in the browser
      'process.env.ENABLE_TYPE_CHECK': JSON.stringify(true),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    }),
  )

  config.output.publicPath = 'auto'
  return config
}
