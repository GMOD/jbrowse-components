const rspack = require('@rspack/core')
const path = require('path')

const buildDir = path.resolve('.')
const distDir = path.resolve(buildDir, 'dist')

const mode = process.env.NODE_ENV || 'production'

module.exports = {
  mode,
  entry: path.join(buildDir, 'src', 'index.ts'),
  devtool: 'source-map',
  output: {
    path: distDir,
    filename:
      mode === 'production'
        ? 'react-linear-genome-view.umd.production.min.js'
        : 'react-linear-genome-view.umd.development.js',
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
    new rspack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
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
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: [/node_modules/],
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: {
              syntax: 'typescript',
            },
          },
        },
        type: 'javascript/auto',
      },
    ],
  },
}
