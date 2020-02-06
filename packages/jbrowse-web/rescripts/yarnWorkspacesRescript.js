/**
 * based on https://github.com/Negan1911/rescripts-use-yarn-workspaces, but with
 * custom resolving of babel-plugin-named-asset-import
 */
const path = require('path')
// eslint-disable-next-line import/no-extraneous-dependencies
const spawn = require('cross-spawn')
// eslint-disable-next-line import/no-extraneous-dependencies
const root = require('find-yarn-workspace-root')()

const pgks = spawn.sync('yarn', ['--json', 'workspaces', 'info'])
const output = JSON.parse(pgks.output[1].toString())
const packages = JSON.parse(output.data)

module.exports = config => {
  return {
    ...config,
    module: {
      ...config.module,
      rules: [
        ...config.module.rules,
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
      ],
    },
  }
}
