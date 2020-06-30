import path from 'path'
import { pascalCase } from 'change-case'
import webpack from 'webpack'

export interface PackageJson {
  name: string
  'jbrowse-plugin'?: { name?: string }
}

export function baseJBrowsePluginWebpackConfig(
  myWebpack: {
    optimize: {
      LimitChunkCountPlugin: typeof webpack.optimize.LimitChunkCountPlugin
    }
  },
  buildDir: string,
  packageJson: PackageJson,
) {
  const pluginConfiguration = packageJson['jbrowse-plugin']

  const pluginNameParamCase =
    pluginConfiguration?.name ||
    packageJson.name.replace('@gmod/jbrowse-plugin-', '')

  return {
    mode: process.env.NODE_ENV || 'production',
    entry: './src/index.ts',
    devtool: process.env.NODE_ENV === 'development' ? 'source-map' : false,
    // @ts-ignore
    output: {
      path: path.resolve(buildDir, 'dist'),
      publicPath: 'dist/',
      filename: `plugin.js`,
      sourceMapFilename: `plugin.js.map`,
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
