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

module.exports = {
  webpack: config => {
    // config.target = 'electron-renderer'
    config.entry.shift()
    config.node.global = true
    config.node.process = true
    config.node.Buffer = true
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
    return config
  },
  devServer: config => {
    config.staticOptions = { fallthrough: false }
    return config
  },
}
