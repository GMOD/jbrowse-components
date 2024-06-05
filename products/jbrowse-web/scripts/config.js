const webpack = require('webpack')

module.exports = function (config) {
  config.plugins.push(
    // this is needed to properly polyfill buffer in desktop, after the CRA5
    // conversion it was observed cram, twobit, etc that use
    // @gmod/binary-parser complained of buffers not being real buffers
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
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
