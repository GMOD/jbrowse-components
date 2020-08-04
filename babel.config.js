module.exports = api => {
  api.cache(false)
  return {
    babelrcRoots: ['.', './packages/*'],
    comments: true,
    presets: [
      '@babel/preset-typescript',
      'react-app',
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
    overrides: [
      {
        test: /generator-jbrowse/,
        presets: [
          '@babel/preset-typescript',
          'react-app',
          [
            '@babel/preset-env',
            {
              targets: {
                node: 'current',
              },
            },
          ],
        ],
      },
    ],
  }
}
