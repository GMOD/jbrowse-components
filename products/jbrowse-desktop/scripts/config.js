const path = require('path')

const webpack = require('webpack')

module.exports = function webpackConfigF(config) {
  config.plugins.push(
    // this is needed to properly polyfill buffer in desktop, after the CRA5
    // conversion it was observed cram, twobit, etc that use
    // @gmod/binary-parser complained of buffers not being real buffers
    // new webpack.ProvidePlugin({
    //   Buffer: ['buffer', 'Buffer'],
    // }),
    new webpack.DefinePlugin({
      // Global mobx-state-tree configuration.
      // Force type checking in production for easier debugging:
      // xref https://github.com/GMOD/jbrowse-components/pull/1575
      'process.env.ENABLE_TYPE_CHECK': '"true"',
    }),
  )

  config.target = 'electron-renderer'
  config.resolve.aliasFields = []
  config.resolve.mainFields = ['module', 'main']

  // Configure webpack to use the non-browser version of generic-filehandle2
  if (!config.resolve.alias) {
    config.resolve.alias = {}
  }
  config.resolve.alias['generic-filehandle2'] = path.resolve(
    __dirname,
    '../../../node_modules/generic-filehandle2/dist/index.js',
  )

  // the 'auto' setting is important for properly resolving the loading of
  // worker chunks xref
  // https://github.com/webpack/webpack/issues/13791#issuecomment-897579223
  config.output.publicPath = 'auto'
  return config
}
