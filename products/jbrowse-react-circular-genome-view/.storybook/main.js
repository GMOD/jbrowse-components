module.exports = {
  stories: [
    '../stories/**/*.mdx',
    '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },

  webpackFinal: async config => {
    config.module.rules.push({
      test: /\.(ts|tsx|js|jsx)$/,
      use: [
        {
          loader: require.resolve('babel-loader'),
          options: {
            rootMode: 'upward',
          },
        },
      ],
    })
    config.resolve.extensions.push('.ts', '.tsx')
    return config
  },
}
