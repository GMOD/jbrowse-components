const path = require('path')
// eslint-disable-next-line import/no-extraneous-dependencies
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
  webpack: config => {
    // Get rid fo the webpackHotDevClient entry
    config.entry.shift()
    // Specify two entry points, a main one and one for the window worker
    const main = config.entry.pop()
    config.entry = {
      main,
      rpc: path.join(path.dirname(main), 'rpcMethods.js'),
    }
    config.plugins[0].options.chunks = ['main']
    // Generate an HTML file for out window workers to load
    config.plugins.unshift(
      new HtmlWebpackPlugin({
        template: path.join(
          path.dirname(config.plugins[0].options.template),
          'workerTemplate.html',
        ),
        chunks: ['rpc'],
        filename: 'worker.html',
      }),
    )
    // Not sure why, but have to change this or the rpc entrypoint won't run
    config.optimization.runtimeChunk = 'single'
    // Make sure some node stuff is polyfilled
    config.node.global = true
    config.node.process = true
    config.node.Buffer = true
    return config
  },
  devServer: config => {
    // Don't redirect to index.html when accessing a non-existent url
    config.staticOptions = { fallthrough: false }
    return config
  },
}

// We probably don't need a custom target ("web" works fine for an electron
// renderer process without nodeIntegration), but in case we ever do, a starting
// point might look like:
// const webpack = require('webpack')
// const FunctionModulePlugin = require(require.resolve(
//   'webpack/lib/FunctionModulePlugin',
// ))
// const LoaderTargetPlugin = require(require.resolve(
//   'webpack/lib/LoaderTargetPlugin',
// ))
// const NodeSourcePlugin = require(require.resolve(
//   'webpack/lib/node/NodeSourcePlugin',
// ))
//
// ...
//
// config.target = compiler => {
//   new webpack.web.JsonpTemplatePlugin().apply(compiler)
//   new webpack.web.FetchCompileWasmTemplatePlugin({
//     mangleImports: config.optimization.mangleWasmImports,
//   }).apply(compiler)
//   new FunctionModulePlugin().apply(compiler)
//   new NodeSourcePlugin(config.node).apply(compiler)
//   new webpack.ExternalsPlugin('commonjs', [
//     'clipboard',
//     'crash-reporter',
//     'desktop-capturer',
//     'electron',
//     'ipc',
//     'ipc-renderer',
//     'native-image',
//     'original-fs',
//     'remote',
//     'screen',
//     'shell',
//     'web-frame',
//   ]).apply(compiler)
//   new LoaderTargetPlugin(config.target).apply(compiler)
// }
