import { execSync } from 'child_process'
import path from 'path'

import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import webpack from 'webpack'
import { WebpackManifestPlugin } from 'webpack-manifest-plugin'

import getClientEnvironment from './env.js'
import modules from './modules.js'
import paths, { moduleFileExtensions } from './paths.js'
import InlineChunkHtmlPlugin from '../react-dev-utils/InlineChunkHtmlPlugin.js'
import InterpolateHtmlPlugin from '../react-dev-utils/InterpolateHtmlPlugin.js'

const shouldUseSourceMap = process.env.GENERATE_SOURCEMAP !== 'false'
const shouldMinimize = process.env.NO_MINIMIZE !== 'true'
const shouldInlineRuntimeChunk = process.env.INLINE_RUNTIME_CHUNK !== 'false'

function getWorkspaces(fromDir) {
  const cwd = fromDir || process.cwd()
  const workspacesStr = execSync('yarn recursive list --json --depth=-1', {
    cwd,
  }).toString()
  return Object.values(JSON.parse(workspacesStr)).map(e => e.path)
}

const cssRegex = /\.css$/
const cssModuleRegex = /\.module\.css$/

export default function webpackBuilder() {
  const isEnvDevelopment = process.env.NODE_ENV === 'development'
  const isEnvProduction = process.env.NODE_ENV === 'production'

  const env = getClientEnvironment(paths.publicUrlOrPath.slice(0, -1))
  const shouldUseReactRefresh = env.raw.FAST_REFRESH

  const getStyleLoaders = cssOptions => {
    return [
      isEnvDevelopment && 'style-loader',
      isEnvProduction && {
        loader: MiniCssExtractPlugin.loader,
        options: paths.publicUrlOrPath.startsWith('.')
          ? { publicPath: '../../' }
          : {},
      },
      { loader: 'css-loader', options: cssOptions },
    ].filter(Boolean)
  }

  return {
    ...(process.env.NO_CACHE ? { cache: false } : {}),
    target: ['browserslist'],
    stats: 'errors-warnings',
    mode: isEnvProduction ? 'production' : 'development',
    bail: isEnvProduction,
    devtool: isEnvProduction
      ? shouldUseSourceMap
        ? 'source-map'
        : false
      : 'eval',
    entry: paths.appIndexJs,
    output: {
      path: paths.appBuild,
      pathinfo: isEnvDevelopment,
      filename: isEnvProduction
        ? 'static/js/[name].[contenthash:8].js'
        : 'static/js/bundle.js',
      chunkFilename: isEnvProduction
        ? 'static/js/[name].[contenthash:8].chunk.js'
        : 'static/js/[name].chunk.js',
      assetModuleFilename: 'static/media/[name].[hash][ext]',
      devtoolModuleFilenameTemplate: isEnvProduction
        ? info =>
            path
              .relative(paths.appSrc, info.absoluteResourcePath)
              .replace(/\\/g, '/')
        : info => path.resolve(info.absoluteResourcePath).replace(/\\/g, '/'),
    },
    resolve: {
      conditionNames: ['mui-modern', '...'],
      modules: ['node_modules', paths.appNodeModules].concat(
        modules.additionalModulePaths || [],
      ),
      extensions: moduleFileExtensions.map(ext => `.${ext}`),
      plugins: [],
    },
    module: {
      strictExportPresence: true,
      rules: [
        shouldUseSourceMap && {
          enforce: 'pre',
          test: /\.(js|mjs|jsx|ts|tsx|css)$/,
          loader: 'source-map-loader',
        },
        {
          oneOf: [
            {
              test: /\.(js|mjs|jsx|ts|tsx)$/,
              include: [paths.appSrc, getWorkspaces()],
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
              test: cssRegex,
              exclude: cssModuleRegex,
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
              test: cssModuleRegex,
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
      ].filter(Boolean),
    },
    plugins: [
      new HtmlWebpackPlugin({
        inject: true,
        template: paths.appHtml,
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
        shouldInlineRuntimeChunk &&
        new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/runtime-.+[.]js/]),
      new InterpolateHtmlPlugin(HtmlWebpackPlugin, env.raw),
      new webpack.DefinePlugin(env.stringified),
      isEnvDevelopment &&
        shouldUseReactRefresh &&
        new ReactRefreshWebpackPlugin({ overlay: false }),
      isEnvProduction &&
        new MiniCssExtractPlugin({
          filename: 'static/css/[name].[contenthash:8].css',
          chunkFilename: 'static/css/[name].[contenthash:8].chunk.css',
        }),
      new WebpackManifestPlugin({
        fileName: 'asset-manifest.json',
        publicPath: paths.publicUrlOrPath,
        generate: (seed, files, entrypoints) => ({
          files: files.reduce((manifest, file) => {
            manifest[file.name] = file.path
            return manifest
          }, seed),
          entrypoints: entrypoints.main.filter(
            fileName => !fileName.endsWith('.map'),
          ),
        }),
      }),
    ].filter(Boolean),
    performance: false,
    optimization: {
      minimize: isEnvProduction && shouldMinimize,
      ...(shouldMinimize ? {} : { minimizer: [] }),
    },
  }
}
