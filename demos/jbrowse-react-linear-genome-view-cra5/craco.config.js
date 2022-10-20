const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')

module.exports = {
  devServer: config => {
    config.static.staticOptions = { fallthrough: false }
    return config
  },
  webpack: {
    plugins: [
      new NodePolyfillPlugin({
        excludeAliases: ['console'],
      }),
    ],
    configure: config => {
      config.resolve.fallback = { fs: false }
      // the 'auto' setting is important for properly resolving the loading of
      // worker chunks xref
      // https://github.com/webpack/webpack/issues/13791#issuecomment-897579223
      config.output.publicPath = 'auto'
      return config
    },
  },
}
