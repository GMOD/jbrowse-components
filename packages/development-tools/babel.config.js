module.exports = api => {
  api.cache(false)
  return {
    babelrcRoots: ['.', './packages/*'],
    comments: true,
    presets: [
      '@babel/preset-typescript',
      [
        '@babel/preset-env',
        {
          targets: {
            node: 'current',
          },
        },
      ],
    ],
    ignore: ['./node_modules', './packages/*/node_modules'],
    plugins: [
      '@babel/plugin-syntax-dynamic-import',
      '@babel/plugin-proposal-class-properties',
      '@babel/plugin-proposal-export-default-from',
      [
        '@babel/transform-runtime',
        {
          regenerator: false,
          useESModules: false,
        },
      ],
    ],
  }
}
