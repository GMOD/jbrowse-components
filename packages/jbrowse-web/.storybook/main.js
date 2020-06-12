const plugin = require('rescripts-use-yarn-workspaces')
const postcssNormalize = require('postcss-normalize')
const webpack_conf = require('react-scripts/config/webpack.config')
const getCSSModuleLocalIdent = require('react-dev-utils/getCSSModuleLocalIdent')


const imageInlineSizeLimit = parseInt(
  process.env.IMAGE_INLINE_SIZE_LIMIT || '10000'
);

const cssRegex = /\.css$/;
const cssModuleRegex = /\.module\.css$/;
const sassRegex = /\.(scss|sass)$/;
const sassModuleRegex = /\.module\.(scss|sass)$/;

const ext = [
  'web.mjs',
  'mjs',
  'web.js',
  'js',
  'web.ts',
  'ts',
  'web.tsx',
  'tsx',
  'json',
  'web.jsx',
  'jsx',
  'mdx'
];

// common function to get style loaders
const getStyleLoaders = (cssOptions, preProcessor) => {
  const loaders = [
    require.resolve('style-loader'),
    {
      loader: require.resolve('css-loader'),
      options: cssOptions,
    },
    {
      // Options for PostCSS as we reference these options twice
      // Adds vendor prefixing based on your specified browser support in
      // package.json
      loader: require.resolve('postcss-loader'),
      options: {
        // Necessary for external CSS imports to work
        // https://github.com/facebook/create-react-app/issues/2677
        ident: 'postcss',
        plugins: () => [
          require('postcss-flexbugs-fixes'),
          require('postcss-preset-env')({
            autoprefixer: {
              flexbox: 'no-2009',
            },
            stage: 3,
          }),
          // Adds PostCSS Normalize as the reset css with default options,
          // so that it honors browserslist config in package.json
          // which in turn let's users customize the target behavior as per their needs.
          postcssNormalize(),
        ],
        sourceMap: true
      },
    },
  ];
  if (preProcessor) {
    loaders.push(
      {
        loader: require.resolve('resolve-url-loader'),
        options: {
          sourceMap: true,
        },
      },
      {
        loader: require.resolve(preProcessor),
        options: {
          sourceMap: true,
        },
      }
    );
  }
  return loaders;
};



/**
 * based on https://github.com/linonetwo/rescript-worker-loader, but with
 * custom resolving of babel-plugin-named-asset-import
 */
// eslint-disable-next-line import/no-extraneous-dependencies
const getCacheIdentifier = require('react-dev-utils/getCacheIdentifier')

module.exports = {
  stories: ['../src/**/*.stories.(mdx|js)'],
  addons: [
    '@storybook/preset-create-react-app',
    '@storybook/addon-actions',
    '@storybook/addon-docs',
    '@storybook/addon-links',
  ],
  webpackFinal: config => {
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
            // presets: loaderListRule.oneOf[1].options.presets,
            // Make sure we have a unique cache identifier, erring on the
            // side of caution.
            // We remove this when the user ejects because the default
            // is sane and uses Babel options. Instead of options, we use
            // the react-scripts and babel-preset-react-app versions.
            cacheIdentifier: getCacheIdentifier(
              isEnvProduction
                ? 'production'
                : isEnvDevelopment && 'development',
              [
                'babel-plugin-named-asset-import',
                'babel-preset-react-app',
                'react-dev-utils',
                'react-scripts',
              ],
            ),
            // plugins: [
            //   ...loaderListRule.oneOf[1].options.plugins,
            //   [
            //     require.resolve('babel-plugin-named-asset-import', {
            //       paths: ['../../node_modules/react-scripts/node_modules'],
            //     }),
            //     {
            //       loaderMap: {
            //         svg: {
            //           ReactComponent: '@svgr/webpack?-prettier,-svgo![path]',
            //         },
            //       },
            //     },
            //     'worker-loader-rescript-babel-plugin-named-asset-import',
            //   ],
            // ],
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
    const _ = webpack_conf('development')
    return plugin({
      ...config,
      resolve: { ...config.resolve, extensions:ext.map(ext => `.${ext}`) },
      module: {
        ...config.module,
        rules: [
          {
            oneOf: [
              {
                test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
                loader: require.resolve('url-loader'),
                options: {
                  limit: imageInlineSizeLimit,
                  name: 'static/media/[name].[hash:8].[ext]',
                },
              },
              // "postcss" loader applies autoprefixer to our CSS.
              // "css" loader resolves paths in CSS and adds assets as dependencies.
              // "style" loader turns CSS into JS modules that inject <style> tags.
              // In production, we use MiniCSSExtractPlugin to extract that CSS
              // to a file, but in development "style" loader enables hot editing
              // of CSS.
              // By default we support CSS Modules with the extension .module.css
              {
                test: cssRegex,
                exclude: cssModuleRegex,
                use: getStyleLoaders({
                  importLoaders: 1,
                  sourceMap: true,
                }),
                // Don't consider CSS imports dead code even if the
                // containing package claims to have no side effects.
                // Remove this when webpack adds a warning or an error for this.
                // See https://github.com/webpack/webpack/issues/6571
                sideEffects: true,
              },
              // Adds support for CSS Modules (https://github.com/css-modules/css-modules)
              // using the extension .module.css
              {
                test: cssModuleRegex,
                use: getStyleLoaders({
                  importLoaders: 1,
                  sourceMap: true,
                  modules: {
                    getLocalIdent: getCSSModuleLocalIdent,
                  },
                }),
              },
              // Opt-in support for SASS (using .scss or .sass extensions).
              // By default we support SASS Modules with the
              // extensions .module.scss or .module.sass
              {
                test: sassRegex,
                exclude: sassModuleRegex,
                use: getStyleLoaders(
                  {
                    importLoaders: 3,
                    sourceMap: true,
                  },
                  'sass-loader'
                ),
                // Don't consider CSS imports dead code even if the
                // containing package claims to have no side effects.
                // Remove this when webpack adds a warning or an error for this.
                // See https://github.com/webpack/webpack/issues/6571
                sideEffects: true,
              },
              // Adds support for CSS Modules, but using SASS
              // using the extension .module.scss or .module.sass
              {
                test: sassModuleRegex,
                use: getStyleLoaders(
                  {
                    importLoaders: 3,
                    sourceMap: true,
                    modules: {
                      getLocalIdent: getCSSModuleLocalIdent,
                    },
                  },
                  'sass-loader'
                ),
              },
    {
      test: /\.mdx?$/,
      use: ['babel-loader', '@mdx-js/loader']
    },
              // "file" loader makes sure those assets get served by WebpackDevServer.
            // When you `import` an asset, you get its (virtual) filename.
            // In production, they would get copied to the `build` folder.
            // This loader doesn't use a "test" so it will catch all modules
            // that fall through the other loaders.
            {
              loader: require.resolve('file-loader'),
              // Exclude `js` files to keep "css" loader working as it injects
              // its runtime that would otherwise be processed through "file" loader.
              // Also exclude `html` and `json` extensions so they get processed
              // by webpacks internal loaders.
              exclude: [/\.(js|mjs|jsx|ts|tsx|ejs|mdx)$/, /\.html$/, /\.json$/],
              options: {
                name: 'static/media/[name].[hash:8].[ext]',
              },
            },
            // ** STOP ** Are you adding a new loader?
            // Make sure to add the new loader(s) before the "file" loader.
            ]
          }
        ]
      }
    })

  },
}
