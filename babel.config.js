module.exports = (api) => {
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
            node: 8,
            browsers: ['> 0.5%', 'last 2 versions'],
          },
        },
      ],
    ],
    ignore: ['./node_modules', './packages/*/node_modules'],
    plugins: [
      '@babel/proposal-class-properties',
      '@babel/plugin-proposal-export-default-from',
      [
        '@babel/transform-runtime',
        {
          regenerator: true,
        },
      ],
    ],
  }
}
