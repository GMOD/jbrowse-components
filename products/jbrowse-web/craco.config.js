const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
const webpack = require('webpack')

module.exports = {
  webpack: {
    target: 'node',

    output: { publicPath: 'auto' },
    plugins: [
      new NodePolyfillPlugin({
        excludeAliases: ['console'],
      }),
      new webpack.ContextReplacementPlugin(/any-promise/),
    ],
    configure: {
      resolve: { fallback: { fs: false } },
    },
  },
}
