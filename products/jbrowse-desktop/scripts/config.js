const webpack = require('webpack')

module.exports = function webpackConfigF(config) {
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

  // similar to our webpack 4 rescript, setting target to
  // 'electron-renderer' helps load 'fs' module for local file access and
  // avoid browser:{} field from package.json being used (which sometimes
  // kicks out fs access e.g. in generic-filehandle)
  config.target = 'electron-renderer'
  config.resolve.aliasFields = []
  config.resolve.mainFields = ['module', 'main']
  // the 'auto' setting is important for properly resolving the loading of
  // worker chunks xref
  // https://github.com/webpack/webpack/issues/13791#issuecomment-897579223
  config.output.publicPath = 'auto'
  return config
}
