import path from 'path'

import webpack from 'webpack'

import { resolveExtensions, sharedRules } from './sharedRules.ts'

// Shared config factory for the standalone UMD product builds
// (react-circular-genome-view, react-linear-genome-view, react-app).
export default function umdConfig({ filename, library }) {
  const mode = process.env.NODE_ENV || 'production'
  return {
    mode,
    entry: './src/webpack.ts',
    devtool: false,
    output: {
      path: path.resolve('dist'),
      filename,
      library,
      libraryTarget: 'umd',
    },
    // UMD bundles are intentionally a single chunk (LimitChunkCountPlugin
    // below), so webpack's code-splitting size hints are pure noise
    performance: false,
    plugins: [new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })],
    resolve: {
      extensions: resolveExtensions,
    },
    module: {
      rules: sharedRules(mode),
    },
  }
}
