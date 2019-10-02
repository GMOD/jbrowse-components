module.exports = {
  webpack: config => {
    config.entry.shift()
    config.node.global = true
    config.node.process = true
    config.node.Buffer = true
    return config
  },
  devServer: config => {
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
