const path = require('path')
const webpack = require('webpack')

module.exports = {
  mode: 'development',
  entry: './src/bin.ts',
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'bundle'),
    filename: 'index.js',
    libraryTarget: 'commonjs2',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  optimization: {
    minimize: false,
  },
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
    new webpack.BannerPlugin({ banner: '#!/usr/bin/env node', raw: true }),
  ],
  module: {
    rules: [
      {
        test: /\.m?[tj]sx?$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: { rootMode: 'upward' },
      },
      {
        test: /\.css$/,
        loader: 'css-loader',
      },
    ],
  },
}
