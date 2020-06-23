import path from 'path'
import { pascalCase } from 'change-case'
import webpack from 'webpack'

export function baseJBrowsePluginWebpackConfig(
  myWebpack: {
    optimize: {
      LimitChunkCountPlugin: typeof webpack.optimize.LimitChunkCountPlugin
    }
  },
  buildDir: string,
  packageJson: { name: string },
) {
  const pluginNameParamCase = packageJson.name.replace(
    '@gmod/jbrowse-plugin-',
    '',
  )

  return {
    mode: process.env.NODE_ENV,
    entry: './src/index.ts',
    devtool: false,
    output: {
      path: path.resolve(buildDir, 'dist'),
      publicPath: 'dist/',
      filename: `plugin.js`,
      library: `JBrowsePlugin${pascalCase(pluginNameParamCase)}`,
      libraryTarget: 'umd',
    },
    plugins: [
      // disable webpack code splitting for plugins
      new myWebpack.optimize.LimitChunkCountPlugin({
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
}
