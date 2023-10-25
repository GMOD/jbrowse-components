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
