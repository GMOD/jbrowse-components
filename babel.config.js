module.exports = api => {
  api.cache(false)
  return {
    babelrcRoots: ['.', './packages/*', './products/*', './plugins/*'],
    comments: true,
    presets: [
      '@babel/preset-react',
      [
        '@babel/preset-env',
        {
          targets: {
            node: 8,
            browsers: ['> 0.5%', 'last 2 versions'],
          },
          // need this to be able to use spread operator on Set and Map
          // see https://github.com/formium/tsdx/issues/376#issuecomment-566750042
          loose: false,
        },
      ],
      '@babel/preset-typescript',
    ],
    ignore: [
      './node_modules',
      './packages/*/node_modules',
      './products/*/node_modules',
      './plugins/*/node_modules',
      './demos/*/node_modules',
    ],
    plugins: [
      '@babel/plugin-syntax-dynamic-import',
      '@babel/plugin-proposal-class-properties',
      '@babel/plugin-proposal-export-default-from',
      ['@babel/transform-runtime', { useESModules: false }],
    ],
  }
}
