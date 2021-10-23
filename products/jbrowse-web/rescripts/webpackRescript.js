const webpack = require('webpack')

module.exports = {
  devServer: config => {
    config.staticOptions = { fallthrough: false }
    return config
  },

  webpack: config => {
    config.plugins.unshift(
      new webpack.DefinePlugin({
        // Global mobx-state-tree configuration.
        // Force type checking in production for easier debugging:
        // xref https://github.com/GMOD/jbrowse-components/pull/1575
        'process.env.ENABLE_TYPE_CHECK': '"true"',
      }),
    )
    return config
  },
}
