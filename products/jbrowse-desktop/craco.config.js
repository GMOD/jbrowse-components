const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
const { getLoader, loaderByName } = require('@craco/craco')
const getYarnWorkspaces = require('get-yarn-workspaces')
const webpack = require('webpack')
const path = require('path')

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
      const { isFound, match } = getLoader(
        webpackConfig,
        loaderByName('babel-loader'),
      )

      // technique here similar to
      // https://github.com/brammitch/monorepo/blob/main/packages/app-one/craco.config.js
      // and compiles the src directories from the apps
      if (isFound) {
        const include = Array.isArray(match.loader.include)
          ? match.loader.include
          : [match.loader.include]
        match.loader.include = include.concat(getYarnWorkspaces())
      }
      return {
        ...webpackConfig,
        resolve: {
          ...webpackConfig.resolve,
          fallback: { fs: false },
        },
        output: {
          ...webpackConfig.output,
          // the 'auto' setting is important for properly resolving the loading
          // of worker chunks
          publicPath: 'auto',
        },
      }
    },
  },
}
