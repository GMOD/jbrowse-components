import { execSync } from 'child_process'

import HtmlWebpackPlugin from 'html-webpack-plugin'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import webpack from 'webpack'

import {
  appBuild,
  appHtml,
  appIndexJs,
  appSrc,
  moduleFileExtensions,
} from './paths.ts'

const shouldUseSourceMap = process.env.GENERATE_SOURCEMAP !== 'false'
const shouldMinimize = process.env.NO_MINIMIZE !== 'true'

function getWorkspaces() {
  const workspacesStr = execSync('pnpm recursive list --json --depth=-1', {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
  return Object.values(
    JSON.parse(workspacesStr) as Record<string, { path: string }>,
  ).map(e => e.path)
}

export const babelOptions = {
  plugins: ['babel-plugin-react-compiler'],
  presets: [
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript',
  ],
}

export default function webpackBuilder(): webpack.Configuration {
  const isEnvDevelopment = process.env.NODE_ENV === 'development'
  const isEnvProduction = process.env.NODE_ENV === 'production'

  const getStyleLoaders = (cssOptions: Record<string, unknown>) => {
    return [
      isEnvDevelopment && 'style-loader',
      isEnvProduction && {
        loader: MiniCssExtractPlugin.loader,
        options: { publicPath: '../../' },
      },
      { loader: 'css-loader', options: cssOptions },
    ].filter(Boolean)
  }

  return {
    stats: 'errors-warnings',
    mode: isEnvProduction ? 'production' : 'development',
    bail: isEnvProduction,
    cache: { type: 'memory' },
    devtool: isEnvProduction
      ? shouldUseSourceMap
        ? 'source-map'
        : false
      : undefined,
    entry: appIndexJs,
    output: {
      path: appBuild,
      publicPath: 'auto',
      filename: isEnvProduction
        ? 'static/js/[name].[contenthash:8].js'
        : 'static/js/bundle.js',
      chunkFilename: isEnvProduction
        ? 'static/js/[name].[contenthash:8].chunk.js'
        : 'static/js/[name].chunk.js',
      assetModuleFilename: 'static/media/[name].[hash][ext]',
    },
    resolve: {
      extensions: moduleFileExtensions.map(ext => `.${ext}`),
    },
    module: {
      strictExportPresence: true,
      rules: [
        ...(shouldUseSourceMap && isEnvProduction
          ? [
              {
                enforce: 'pre' as const,
                test: /\.(js|mjs|jsx|ts|tsx|css)$/,
                loader: 'source-map-loader',
              },
            ]
          : []),
        {
          oneOf: [
            {
              test: /\.(js|mjs|jsx|ts|tsx)$/,
              include: [appSrc, getWorkspaces()],
              loader: 'babel-loader',
              options: babelOptions,
            },
            {
              test: /\.css$/,
              exclude: /\.module\.css$/,
              use: getStyleLoaders({
                importLoaders: 1,
                sourceMap: isEnvDevelopment || shouldUseSourceMap,
                modules: { mode: 'icss' },
              }),
              sideEffects: true,
            },
            {
              test: /\.module\.css$/,
              use: getStyleLoaders({
                importLoaders: 1,
                sourceMap: isEnvDevelopment || shouldUseSourceMap,
                modules: { mode: 'local' },
              }),
            },
            {
              exclude: [/^$/, /\.(js|mjs|jsx|ts|tsx)$/, /\.html$/, /\.json$/],
              type: 'asset/resource',
            },
          ],
        },
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.ENABLE_TYPE_CHECK': '"true"',
      }),
      new HtmlWebpackPlugin({
        inject: true,
        template: appHtml,
        ...(isEnvProduction && shouldMinimize
          ? {
              minify: {
                removeComments: true,
                collapseWhitespace: true,
                removeRedundantAttributes: true,
                useShortDoctype: true,
                removeEmptyAttributes: true,
                removeStyleLinkTypeAttributes: true,
                keepClosingSlash: true,
                minifyJS: true,
                minifyCSS: true,
                minifyURLs: true,
              },
            }
          : {}),
      }),
      ...(isEnvProduction
        ? [
            new MiniCssExtractPlugin({
              filename: 'static/css/[name].[contenthash:8].css',
              chunkFilename: 'static/css/[name].[contenthash:8].chunk.css',
            }),
          ]
        : []),
    ],
    performance: false,
    optimization: {
      minimize: isEnvProduction && shouldMinimize,
    },
  }
}
