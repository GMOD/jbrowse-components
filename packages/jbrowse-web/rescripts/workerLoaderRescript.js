/**
 * based on https://github.com/linonetwo/rescript-worker-loader, but with
 * custom resolving of babel-plugin-named-asset-import
 */
// eslint-disable-next-line import/no-extraneous-dependencies
const getCacheIdentifier = require('react-dev-utils/getCacheIdentifier')

module.exports = config => {
  const isEnvProduction = config.mode === 'production'
  const isEnvDevelopment = !isEnvProduction
  // get something that has setted appSrc and fill here
  const appSrc = config.module.rules[1].include
  // https://github.com/webpack/webpack/issues/6642#issuecomment-371087342
  config.output.globalObject = 'this'
  // find the rule with 'oneOf'
  const loaderListRule = config.module.rules.find(ruleObj =>
    Array.isArray(ruleObj.oneOf),
  )
  if (!loaderListRule) {
    throw new Error('No found loader config list')
  }
  loaderListRule.oneOf.unshift({
    test: /\.worker\.(js|mjs|ts)$/,
    include: appSrc,
    use: [
      require.resolve('worker-loader'),
      {
        loader: require.resolve('babel-loader'),
        options: {
          customize: require.resolve(
            'babel-preset-react-app/webpack-overrides',
          ),
          babelrc: false,
          configFile: false,
          // get preset setting from loader that matches normal js file and fill here
          presets: loaderListRule.oneOf[1].options.presets,
          // Make sure we have a unique cache identifier, erring on the
          // side of caution.
          // We remove this when the user ejects because the default
          // is sane and uses Babel options. Instead of options, we use
          // the react-scripts and babel-preset-react-app versions.
          cacheIdentifier: getCacheIdentifier(
            isEnvProduction ? 'production' : isEnvDevelopment && 'development',
            [
              'babel-plugin-named-asset-import',
              'babel-preset-react-app',
              'react-dev-utils',
              'react-scripts',
            ],
          ),
          plugins: [
            ...loaderListRule.oneOf[1].options.plugins,
            [
              require.resolve('babel-plugin-named-asset-import', {
                paths: ['../../node_modules/react-scripts/node_modules'],
              }),
              {
                loaderMap: {
                  svg: {
                    ReactComponent: '@svgr/webpack?-prettier,-svgo![path]',
                  },
                },
              },
              'worker-loader-rescript-babel-plugin-named-asset-import',
            ],
          ],
          // This is a feature of `babel-loader` for webpack (not Babel itself).
          // It enables caching results in ./node_modules/.cache/babel-loader/
          // directory for faster rebuilds.
          cacheDirectory: true,
          cacheCompression: isEnvProduction,
          compact: isEnvProduction,
        },
      },
    ],
  })

  return config
}
