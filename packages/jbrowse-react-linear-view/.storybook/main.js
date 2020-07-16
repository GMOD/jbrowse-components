const path = require('path')
const spawn = require('cross-spawn')
const root = require('find-yarn-workspace-root')()

const pgks = spawn.sync('yarn', ['--json', 'workspaces', 'info'])
const output = JSON.parse(pgks.output[1].toString())
const packages = JSON.parse(output.data)

module.exports = {
  stories: ['../stories/**/*.stories.(ts|tsx)'],
  addons: [
    '@storybook/addon-actions',
    '@storybook/addon-links',
    {
      name: '@storybook/addon-docs',
      options: { configureJSX: true },
    },
    {
      name: '@storybook/preset-create-react-app',
      options: { scriptsPackageName: 'react-scripts' },
    },
  ],
  webpackFinal: async config => {
    config.module.rules.push(
      {
        test: /\.(ts|tsx)$/,
        use: [
          {
            loader: require.resolve('ts-loader'),
            options: { transpileOnly: true },
          },
          { loader: require.resolve('react-docgen-typescript-loader') },
        ],
      },
      {
        test: /\.(js|mjs|jsx|ts|tsx)$/,
        include: Object.keys(packages).map(_ =>
          path.join(root, packages[_].location),
        ),
        loader: require.resolve('babel-loader'),
        options: {
          customize: require.resolve(
            'babel-preset-react-app/webpack-overrides',
          ),
          presets: [require.resolve('babel-preset-react-app')],
          plugins: [
            [
              require.resolve('babel-plugin-named-asset-import', {
                paths: ['../../node_modules/react-scripts/node_modules'],
              }),
              {
                loaderMap: {
                  svg: { ReactComponent: '@svgr/webpack?-svgo,+ref![path]' },
                },
              },
              'yarn-workspaces-rescript-babel-plugin-named-asset-import',
            ],
          ],
        },
      },
    )

    config.resolve.extensions.push('.ts', '.tsx')

    return config
  },
}
