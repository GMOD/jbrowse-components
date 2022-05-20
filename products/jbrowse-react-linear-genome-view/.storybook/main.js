const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
module.exports = {
  stories: ['../stories/**/*.stories.@(ts|tsx|mdx)'],

  addons: [
    '@storybook/addon-actions',
    '@storybook/addon-links',
    '@storybook/addon-docs',
  ],

  webpackFinal: async config => {
    config.plugins.push(
      new NodePolyfillPlugin({
        excludeAliases: ['console'],
      }),
    )
    config.module.rules.push({
      test: /\.(ts|tsx|js|jsx)$/,
      use: [
        {
          loader: require.resolve('ts-loader'),
          options: { transpileOnly: true },
        },
      ],
    })
    config.resolve.fallback.fs = false
    config.resolve.extensions.push('.ts', '.tsx')
    return config
  },

  core: {
    builder: 'webpack5',
  },
}
