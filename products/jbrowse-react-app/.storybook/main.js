const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
module.exports = {
  stories: ['../stories/**/*.mdx', '../stories/**/*.stories.@(js|jsx|ts|tsx)'],
  staticDirs: ['../public'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/preset-create-react-app',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  docs: {
    docsPage: true,
  },

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
}
