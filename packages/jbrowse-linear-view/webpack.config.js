/* eslint-disable import/no-extraneous-dependencies */
const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')

const buildDir = path.resolve('.')
const distDir = path.resolve(buildDir, 'dist')

// style files regexes
const cssRegex = /\.css$/
const sassRegex = /\.(scss|sass)$/

// common function to get style loaders, stolen from create-react-app
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
          // eslint-disable-next-line import/no-extraneous-dependencies
          require('postcss-flexbugs-fixes'),
          // eslint-disable-next-line import/no-extraneous-dependencies
          require('postcss-preset-env')({
            autoprefixer: {
              flexbox: 'no-2009',
            },
            stage: 3,
          }),
        ],
      },
    },
  ]
  if (preProcessor) {
    loaders.push(require.resolve(preProcessor))
  }
  return loaders
}

module.exports = {
  mode: process.env.NODE_ENV || 'production',
  entry: path.join(buildDir, 'src', 'index.js'),
  devtool: process.env.NODE_ENV === 'development' ? 'source-map' : false,
  output: {
    path: distDir,
    filename: 'jbrowse-linear-view.js',
    sourceMapFilename: 'jbrowse-linear-view.js.map',
    library: 'JBrowseLinearView',
    libraryExport: 'default',
    libraryTarget: 'umd',
  },
  devServer: {
    contentBase: path.join(distDir, 'assets'),
    port: 9000,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
    },
  },
  plugins: [
    new CopyPlugin({
      patterns: [{ from: path.resolve(buildDir, 'assets'), to: distDir }],
      options: {
        concurrency: 100,
      },
    }),
  ],
  resolve: {
    extensions: [
      '.mjs',
      '.web.js',
      '.js',
      '.ts',
      '.tsx',
      '.json',
      '.web.jsx',
      '.jsx',
    ],
  },
  module: {
    rules: [
      {
        oneOf: [
          {
            test: /\.m?[tj]sx?$/,
            exclude: /(node_modules|bower_components)/,
            use: {
              loader: 'babel-loader',
              options: {
                comments: true,
                presets: [
                  '@babel/preset-typescript',
                  '@babel/preset-react',
                  [
                    '@babel/preset-env',
                    {
                      targets: {
                        node: 'current',
                        browsers: ['> 0.5%', 'last 2 versions'],
                      },
                    },
                  ],
                ],
                ignore: ['./node_modules', './packages/*/node_modules'],
                plugins: [
                  '@babel/plugin-syntax-dynamic-import',
                  '@babel/plugin-proposal-class-properties',
                  '@babel/plugin-proposal-export-default-from',
                  [
                    '@babel/transform-runtime',
                    {
                      regenerator: true,
                    },
                  ],
                ],
              },
            },
          },
          {
            test: cssRegex,
            use: getStyleLoaders({
              importLoaders: 1,
            }),
          },
          {
            test: sassRegex,
            use: getStyleLoaders({ importLoaders: 2 }, 'sass-loader'),
          },
          {
            loader: require.resolve('file-loader'),
            exclude: [/\.(js|mjs|jsx|ts|tsx)$/, /\.html$/, /\.json$/],
          },
          // ** STOP ** Are you adding a new loader?
          // Make sure to add the new loader(s) before the "file" loader.
        ],
      },
    ],
  },
}
