module.exports = {
  stories: ['../stories/**/*.mdx', '../stories/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  docs: {
    docsPage: true,
  },

  webpackFinal: async config => {
    config.module.rules.push({
      test: /\.(ts|tsx|js|jsx)$/,
      use: [
        {
          loader: require.resolve('babel-loader'),
          options: {
            rootMode: 'upward',
            presets: ['@babel/preset-react'],
          },
        },
      ],
    })
    config.resolve.extensions.push('.ts', '.tsx')
    return config
  },
}
