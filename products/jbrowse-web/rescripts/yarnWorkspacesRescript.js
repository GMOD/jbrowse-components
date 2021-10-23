/* eslint-disable no-console */
/**
 * based on https://github.com/Negan1911/rescripts-use-yarn-workspaces, but with
 * custom resolving of babel-plugin-named-asset-import
 */
const fs = require('fs')
const path = require('path')
const spawn = require('cross-spawn')
const root = require('find-yarn-workspace-root')()

const pgks = spawn.sync('yarn', ['--json', 'workspaces', 'info'])
const output = JSON.parse(pgks.output[1].toString())
const packages = JSON.parse(output.data)

function pkgJsonUsesDist(location) {
  const pkgJsonLocation = path.join(root, location, 'package.json')
  let pkgJsonText
  try {
    pkgJsonText = fs.readFileSync(pkgJsonLocation)
  } catch (error) {
    console.error(error)
    console.log('package.json not found:', pkgJsonLocation)
    process.exit(1)
  }
  let pkgJson
  try {
    pkgJson = JSON.parse(pkgJsonText)
  } catch (error) {
    console.log('Syntax error in package.json')
    process.exit(2)
  }
  return Boolean(pkgJson.main) && pkgJson.main.startsWith('dist')
}

module.exports = config => {
  Object.entries(packages).forEach(([package, info]) => {
    if (pkgJsonUsesDist(info.location)) {
      delete packages[package]
    }
  })
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
