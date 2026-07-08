import path from 'path'

import webpack from 'webpack'

// Shared config factory for the standalone UMD product builds
// (react-circular-genome-view, react-linear-genome-view, react-app).
// Keeping these in one place ensures fixes like the .mjs fullySpecified rule
// below stay in sync across all products.
export default function umdConfig({ filename, library, cssUse }) {
  const mode = process.env.NODE_ENV || 'production'
  return {
    mode,
    entry: './src/webpack.ts',
    devtool: 'source-map',
    output: {
      path: path.resolve('dist'),
      filename,
      library,
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
          // MUI v9 and other ESM deps ship .mjs files with extensionless
          // subpath imports (e.g. react-transition-group/TransitionGroupContext);
          // webpack 5 treats .mjs as fully specified and rejects them otherwise
          test: /\.m?js$/,
          resolve: { fullySpecified: false },
        },
        {
          test: /\.m?[tj]sx?$/,
          exclude: /node_modules/,
          loader: 'babel-loader',
          // Babel's own envName defaults independently of webpack's `mode`
          // (falls back to 'development' when NODE_ENV is unset, even though
          // `mode` above falls back to 'production') — pin it to `mode` so
          // @babel/preset-react's automatic runtime can't pick the dev jsxDEV
          // transform while webpack bundles the production react runtime
          // (which has no jsxDEV export), a mismatch that crashes at runtime.
          options: { rootMode: 'upward', envName: mode },
        },
        // only react-app imports a .css file (dockview); css-loader resolves it
        // and style-loader injects it into the DOM
        ...(cssUse ? [{ test: /\.css$/, use: cssUse }] : []),
      ],
    },
  }
}
