module.exports = function babelConfig(api) {
  api.cache(true)
  return {
    presets: [
      '@babel/preset-react',
      '@babel/preset-env',
      '@babel/preset-typescript',
    ],
    ignore: [
      './node_modules',
      './packages/*/node_modules',
      './products/*/node_modules',
      './plugins/*/node_modules',
      './demos/*/node_modules',
    ],
  }
}
