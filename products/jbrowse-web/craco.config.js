const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
const webpack = require('webpack')

module.exports = {
  devServer: config => {
    config.static.staticOptions = { fallthrough: false }
    return config
  },
  webpack: {
    target: 'node',

    plugins: [
      new NodePolyfillPlugin({
        excludeAliases: ['console'],
      }),
      new webpack.ContextReplacementPlugin(/any-promise/),
    ],
    configure: webpackConfig => {
      const { plugins } = webpackConfig

      // we add build:true to use the project references that help build all of
      // our dependencies, the last element in the array is the fork ts loader
      plugins[plugins.length - 1].options.typescript.build = true

      return {
        ...webpackConfig,
        resolve: {
          ...webpackConfig.resolve,
          fallback: { fs: false },
        },
        output: {
          ...webpackConfig.output,
          publicPath: 'auto',
        },
      }
    },
  },
}
