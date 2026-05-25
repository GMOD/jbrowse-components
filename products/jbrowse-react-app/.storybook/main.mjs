import remarkGfm from 'remark-gfm'

export default {
  stories: [
    '../stories/**/*.mdx',
    '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    {
      name: '@storybook/addon-docs',
      options: {
        mdxPluginOptions: {
          mdxCompileOptions: {
            remarkPlugins: [remarkGfm],
          },
        },
      },
    },
  ],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  staticDirs: ['../public'],

  webpackFinal: async config => {
    config.module.rules.push({
      test: /\.(ts|tsx|js|jsx)$/,
      use: [
        {
          loader: 'babel-loader',
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
