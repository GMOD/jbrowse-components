const path = require('path')

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
          // eslint-disable-next-line global-require, import/no-extraneous-dependencies
          require('postcss-flexbugs-fixes'),
          // eslint-disable-next-line global-require, import/no-extraneous-dependencies
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
  mode: 'development',
  entry: './src/Viewer.js',
  output: {
    path: path.resolve(__dirname, 'umd'),
    publicPath: 'umd/',
    filename: 'jbrowse-protein-viewer.js',
    library: 'JBrowseProteinViewer',
    libraryTarget: 'umd',
  },
  module: {
    rules: [
      {
        oneOf: [
          {
            test: /\.m?js$/,
            exclude: /(node_modules|bower_components)/,
            use: {
              loader: 'babel-loader',
              options: {
                presets: ['@babel/preset-env', '@babel/preset-react'],
                plugins: ['@babel/plugin-proposal-class-properties'],
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
            exclude: [/\.(js|mjs|jsx)$/, /\.html$/, /\.json$/],
          },
          // ** STOP ** Are you adding a new loader?
          // Make sure to add the new loader(s) before the "file" loader.
        ],
      },
    ],
  },
}
