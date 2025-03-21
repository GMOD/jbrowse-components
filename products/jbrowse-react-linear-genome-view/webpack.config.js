const path = require('path')
const webpack = require('webpack')

const buildDir = path.resolve('.')
const distDir = path.resolve(buildDir, 'dist')

const mode = process.env.NODE_ENV || 'development'

module.exports = {
  mode,
  entry: path.join(buildDir, 'src', 'webpack.ts'),
  devtool: 'source-map',
  output: {
    path: distDir,
    filename: 'react-linear-genome-view.umd.development.js',
    library: 'JBrowseReactLinearGenomeView',
    libraryTarget: 'umd',
  },
  devServer: {
    port: 9000,
    open: 'umd_example/',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
    },
  },
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
    new webpack.ProvidePlugin({
      React: 'react',
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
                rootMode: 'upward',
                presets: ['@babel/preset-react'],
              },
            },
          },
        ],
      },
    ],
  },
}
