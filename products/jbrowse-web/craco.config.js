const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
// eslint-disable-next-line import/no-extraneous-dependencies
const { getLoader, loaderByName } = require('@craco/craco')
// eslint-disable-next-line import/no-extraneous-dependencies
const getYarnWorkspaces = require('get-yarn-workspaces')
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
      new webpack.DefinePlugin({
        // Global mobx-state-tree configuration.
        // Force type checking in production for easier debugging:
        // xref https://github.com/GMOD/jbrowse-components/pull/1575
        'process.env.ENABLE_TYPE_CHECK': '"true"',
      }),
    ],
    configure: config => {
      const { isFound, match } = getLoader(config, loaderByName('babel-loader'))

      // technique here similar to
      // https://github.com/brammitch/monorepo/blob/main/packages/app-one/craco.config.js
      // and compiles the src directories from the apps
      if (isFound) {
        const include = Array.isArray(match.loader.include)
          ? match.loader.include
          : [match.loader.include]
        match.loader.include = include.concat(getYarnWorkspaces())
      }

      config.resolve.fallback = { fs: false }
      // the 'auto' setting is important for properly resolving the loading of
      // worker chunks xref
      // https://github.com/webpack/webpack/issues/13791#issuecomment-897579223
      config.output.publicPath = 'auto'

      config.cache = false
      return config
    },
  },
}
