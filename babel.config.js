module.exports = api => {
  api.cache(true)
  return {
    ignore: [
      './node_modules',
      './packages/*/node_modules',
      './products/*/node_modules',
      './plugins/*/node_modules',
      './demos/*/node_modules',
    ],
    presets: [
      '@babel/preset-react',
      '@babel/preset-env',
      '@babel/preset-typescript',
    ],
  }
}
