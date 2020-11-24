import path from 'path'
import { pascalCase } from 'change-case'
import CopyPlugin from 'copy-webpack-plugin'

import ReExportsList from '@jbrowse/core/ReExports/list'

export interface PackageJson {
  name: string
  'jbrowse-plugin'?: { name?: string }
}

const externals: {
  [k: string]: {
    root: string[]
    commonjs: string
    commonjs2: string
    amd: string
  }
} = {}
ReExportsList.forEach(moduleName => {
  externals[moduleName] = {
    root: ['JBrowseExports', moduleName],
    commonjs: moduleName,
    commonjs2: moduleName,
    amd: moduleName,
  }
})

// style files regexes
const cssRegex = /\.css$/
const sassRegex = /\.(scss|sass)$/

// common function to get style loaders, stolen from create-react-app
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getStyleLoaders = (cssOptions: any, preProcessor?: string) => {
  const loaders = [
    require.resolve('style-loader'),
    {
      loader: require.resolve('css-loader'),
      options: cssOptions,
    },
    {
      // Options for PostCSS as we reference these options twice
      // Adds vendor prefixing based on your specified browser support in
      // package.json
      loader: require.resolve('postcss-loader'),
      options: {
        // Necessary for external CSS imports to work
        // https://github.com/facebook/create-react-app/issues/2677
        ident: 'postcss',
        plugins: () => [
          require('postcss-flexbugs-fixes'),
          require('postcss-preset-env')({
            autoprefixer: { flexbox: 'no-2009' },
            stage: 3,
          }),
        ],
      },
    },
  ]
  if (preProcessor) {
    loaders.push(require.resolve(preProcessor))
  }
  return loaders
}

export function baseJBrowsePluginWebpackConfig(
  buildDir: string,
  packageJson: PackageJson,
) {
  const pluginConfiguration = packageJson['jbrowse-plugin']

  const pluginName =
    pluginConfiguration?.name ||
    pascalCase(packageJson.name.replace('@jbrowse/plugin-', ''))

  const distDir = path.resolve(buildDir, 'dist')

  return {
    mode: process.env.NODE_ENV || 'production',
    entry: './src/index.ts',
    devtool: process.env.NODE_ENV === 'development' ? 'source-map' : false,
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
                          node: 10,
                          browsers: ['> 0.5%', 'last 2 versions'],
                        },
                      },
                    ],
                  ],
                  ignore: [
                    './node_modules',
                    './packages/*/node_modules',
                    './products/*/node_modules',
                    './plugins/*/node_modules',
                  ],
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
              test: cssRegex,
              use: getStyleLoaders({ importLoaders: 1 }),
            },
            {
              test: sassRegex,
              use: getStyleLoaders({ importLoaders: 2 }, 'sass-loader'),
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
