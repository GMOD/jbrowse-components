import path from 'path'
import webpack from 'webpack'

export default {
  mode: process.env.NODE_ENV || 'production',
  entry: './src/webpack.ts',
  devtool: 'source-map',
  output: {
    path: path.resolve('dist'),
    filename: 'react-linear-genome-view.umd.production.min.js',
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
  plugins: [new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })],
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.tsx', '.jsx', '.json'],
  },
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
