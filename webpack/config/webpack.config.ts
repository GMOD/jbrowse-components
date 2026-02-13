import { execSync } from 'child_process'

import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin'
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
import InlineChunkHtmlPlugin from '../InlineChunkHtmlPlugin.ts'

const shouldUseSourceMap = process.env.GENERATE_SOURCEMAP !== 'false'
const shouldMinimize = process.env.NO_MINIMIZE !== 'true'

function getWorkspaces() {
  const workspacesStr = execSync('pnpm recursive list --json --depth=-1', {
    cwd: process.cwd(),
  }).toString()
  return Object.values(
    JSON.parse(workspacesStr) as Record<string, { path: string }>,
  ).map(e => e.path)
}

export default function webpackBuilder(): webpack.Configuration {
  const isEnvDevelopment = process.env.NODE_ENV === 'development'
  const isEnvProduction = process.env.NODE_ENV === 'production'

  const shouldUseReactRefresh = process.env.FAST_REFRESH !== 'false'

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
    target: ['browserslist'],
    stats: 'errors-warnings',
    mode: isEnvProduction ? 'production' : 'development',
    bail: isEnvProduction,
    devtool: isEnvProduction
      ? shouldUseSourceMap
        ? 'source-map'
        : false
      : ('eval' as const),
    entry: appIndexJs,
    output: {
      path: appBuild,
      pathinfo: isEnvDevelopment,
      filename: isEnvProduction
        ? 'static/js/[name].[contenthash:8].js'
        : 'static/js/bundle.js',
      chunkFilename: isEnvProduction
        ? 'static/js/[name].[contenthash:8].chunk.js'
        : 'static/js/[name].chunk.js',
      assetModuleFilename: 'static/media/[name].[hash][ext]',
    },
    resolve: {
      conditionNames: ['mui-modern', '...'],
      extensions: moduleFileExtensions.map(ext => `.${ext}`),
    },
    module: {
      strictExportPresence: true,
      rules: [
        shouldUseSourceMap
          ? {
              enforce: 'pre' as const,
              test: /\.(js|mjs|jsx|ts|tsx|css)$/,
              loader: 'source-map-loader',
            }
          : false,
        {
          oneOf: [
            {
              test: /\.(js|mjs|jsx|ts|tsx)$/,
              include: [appSrc, getWorkspaces()],
              loader: 'babel-loader',
              options: {
                plugins: ['babel-plugin-react-compiler'],
                presets: [
                  ['@babel/preset-react', { runtime: 'automatic' }],
                  '@babel/preset-typescript',
                ],
              },
            },
            {
              test: /\.css$/,
              exclude: /\.module\.css$/,
              use: getStyleLoaders({
                importLoaders: 1,
                sourceMap: isEnvProduction
                  ? shouldUseSourceMap
                  : isEnvDevelopment,
                modules: { mode: 'icss' },
              }),
              sideEffects: true,
            },
            {
              test: /\.module\.css$/,
              use: getStyleLoaders({
                importLoaders: 1,
                sourceMap: isEnvProduction
                  ? shouldUseSourceMap
                  : isEnvDevelopment,
                modules: { mode: 'local' },
              }),
            },
            {
              exclude: [/^$/, /\.(js|mjs|jsx|ts|tsx)$/, /\.html$/, /\.json$/],
              type: 'asset/resource',
            },
          ],
        },
      ].filter(Boolean) as webpack.RuleSetRule[],
    },
    plugins: [
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
      isEnvProduction &&
        new InlineChunkHtmlPlugin(
          HtmlWebpackPlugin as unknown as InlineChunkHtmlPlugin['htmlWebpackPlugin'],
          [/runtime-.+[.]js/],
        ),
      isEnvDevelopment &&
        shouldUseReactRefresh &&
        new ReactRefreshWebpackPlugin({ overlay: false }),
      isEnvProduction &&
        new MiniCssExtractPlugin({
          filename: 'static/css/[name].[contenthash:8].css',
          chunkFilename: 'static/css/[name].[contenthash:8].chunk.css',
        }),
    ].filter(Boolean),
    performance: false,
    optimization: {
      minimize: isEnvProduction && shouldMinimize,
      ...(shouldMinimize ? {} : { minimizer: [] }),
    },
  }
}
