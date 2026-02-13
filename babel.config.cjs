// eslint-disable-next-line no-undef
module.exports = function babelConfig(api) {
  api.cache(true)
  return {
    plugins: ['babel-plugin-react-compiler'],
    presets: [
      [
        '@babel/preset-react',
        {
          runtime: 'automatic',
        },
      ],
      '@babel/preset-env',
      '@babel/preset-typescript',
    ],
    ignore: [
      './node_modules/(?!.*(@exodus/bytes|@csstools|parse5))',
      './packages/*/node_modules',
      './products/*/node_modules',
      './plugins/*/node_modules',
      './demos/*/node_modules',
    ],
    overrides: [
      {
        test: /node_modules/,
        presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
      },
    ],
  }
}
