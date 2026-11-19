import HtmlWebpackPlugin from 'html-webpack-plugin'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import webpack from 'webpack'

import { resolveExtensions, sharedRules } from '../sharedRules.ts'
import { appBuild, appHtml, appIndexJs } from './paths.ts'

const shouldUseSourceMap = process.env.GENERATE_SOURCEMAP !== 'false'
const shouldMinimize = process.env.NO_MINIMIZE !== 'true'

export default function webpackBuilder(): webpack.Configuration {
  const isEnvDevelopment = process.env.NODE_ENV === 'development'
  const isEnvProduction = process.env.NODE_ENV === 'production'
  const mode = isEnvProduction ? 'production' : 'development'

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
    mode,
    bail: isEnvProduction,
    // filesystem cache persists across dev-server restarts so cold starts
    // after the first are fast; production builds (often a fresh CI checkout)
    // gain nothing from it, so keep them in memory
    cache: isEnvDevelopment
      ? {
          type: 'filesystem',
          buildDependencies: { config: [import.meta.filename] },
        }
      : { type: 'memory' },
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
      extensions: resolveExtensions,
    },
    module: {
      strictExportPresence: true,
      rules: [
        ...sharedRules(mode),
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
              test: /\.css$/,
              use: getStyleLoaders({
                importLoaders: 1,
                sourceMap: isEnvDevelopment || shouldUseSourceMap,
              }),
              sideEffects: true,
            },
            {
              exclude: [
                /^$/,
                /\.(js|mjs|cjs|jsx|ts|tsx)$/,
                /\.html$/,
                /\.json$/,
              ],
              type: 'asset/resource',
            },
          ],
        },
      ],
    },
    plugins: [
      // No DefinePlugin: nothing in the browser bundle reads a node global.
      // MST's run-time type-checking is turned on by a setTypeChecking(true)
      // call in the app's own entry point instead of by substituting
      // process.env.ENABLE_TYPE_CHECK here — that keeps the flag a property of
      // the app rather than of the build, and works under any bundler.
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
