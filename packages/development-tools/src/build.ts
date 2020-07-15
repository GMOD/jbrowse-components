import path from 'path'
import { pascalCase } from 'change-case'
import webpack from 'webpack'
import CopyPlugin from 'copy-webpack-plugin'

import { objectFromEntries } from '@gmod/jbrowse-core/util'
import ReExportsList from '@gmod/jbrowse-core/ReExports/list'

export interface PackageJson {
  name: string
  'jbrowse-plugin'?: { name?: string }
}

if (Object.fromEntries) {
  Object.fromEntries = objectFromEntries
}

const externals = Object.fromEntries(
  ReExportsList.map(moduleName => {
    return [
      moduleName,
      {
        root: ['JBrowseExports', moduleName],
        commonjs: moduleName,
        commonjs2: moduleName,
        amd: moduleName,
      },
    ]
  }),
)

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

  const pluginName =
    pluginConfiguration?.name ||
    pascalCase(packageJson.name.replace('@gmod/jbrowse-plugin-', ''))

  const distDir = path.resolve(buildDir, 'dist')

  return {
    mode: process.env.NODE_ENV || 'production',
    entry: './src/index.ts',
    devtool: process.env.NODE_ENV === 'development' ? 'source-map' : false,
    // @ts-ignore
    output: {
      path: distDir,
      filename: `plugin.js`,
      sourceMapFilename: `plugin.js.map`,
      library: `JBrowsePlugin${pluginName}`,
      libraryTarget: 'umd',
    },
    devServer: {
      contentBase: path.join(buildDir, 'assets'),
      port: 9000,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
    },
    externals,
    plugins: [
      new CopyPlugin({
        patterns: [{ from: path.resolve(buildDir, 'assets'), to: distDir }],
        options: {
          concurrency: 100,
        },
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
                  comments: true,
                  presets: [
                    '@babel/preset-typescript',
                    '@babel/preset-react',
                    [
                      '@babel/preset-env',
                      {
                        targets: {
                          node: 'current',
                          browsers: ['> 0.5%', 'last 2 versions'],
                        },
                      },
                    ],
                  ],
                  ignore: ['./node_modules', './packages/*/node_modules'],
                  plugins: [
                    '@babel/plugin-syntax-dynamic-import',
                    '@babel/plugin-proposal-class-properties',
                    '@babel/plugin-proposal-export-default-from',
                    [
                      '@babel/transform-runtime',
                      {
                        regenerator: true,
                      },
                    ],
                  ],
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
