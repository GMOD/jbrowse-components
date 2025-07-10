const path = require('path')
const webpack = require('webpack')

module.exports = {
  mode: 'development', // Use development mode to avoid minification
  entry: './src/bin.ts',
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    libraryTarget: 'commonjs2',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  optimization: {
    minimize: false, // Disable minification
  },
  // Use LimitChunkCountPlugin to ensure only one output file
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
  ],
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
          {
            test: /\.css$/,
            use: {
              loader: require.resolve('css-loader'),
            },
          },
        ],
      },
    ],
  },
}
