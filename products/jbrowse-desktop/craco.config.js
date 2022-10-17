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
    plugins: [
      new NodePolyfillPlugin({
        excludeAliases: ['console'],
      }),

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
    },
  },
}
