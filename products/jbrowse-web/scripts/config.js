const webpack = require('webpack')

module.exports = function webpackConfig(config) {
  config.plugins.push(
    new webpack.DefinePlugin({
      // Global mobx-state-tree configuration.
      // Force type checking in production for easier debugging:
      // xref https://github.com/GMOD/jbrowse-components/pull/1575
      'process.env.ENABLE_TYPE_CHECK': '"true"',
    }),
  )

  config.output.publicPath = 'auto'

  // Disable minification for profiling builds
  // Usage: PROFILING_BUILD=true yarn build
  if (process.env.PROFILING_BUILD === 'true') {
    console.log('🔬 PROFILING BUILD: Minification disabled for better profiling results')
    config.optimization = config.optimization || {}
    config.optimization.minimize = false
  }

  return config
}
