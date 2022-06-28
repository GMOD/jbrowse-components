const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
const webpack = require('webpack')

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
    configure: {
      resolve: {
        fallback: { fs: false },
      },
    },
  },
}
