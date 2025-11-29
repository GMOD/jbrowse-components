const cp = require('child_process')
const fs = require('fs')
const path = require('path')

const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const webpack = require('webpack')
const { WebpackManifestPlugin } = require('webpack-manifest-plugin')

// Resolve paths relative to the app directory
const appDirectory = fs.realpathSync(process.cwd())
const resolveApp = relativePath => path.resolve(appDirectory, relativePath)

const moduleFileExtensions = ['.js', '.ts', '.tsx', '.jsx', '.mjs', '.json']

// Get public URL from homepage in package.json or PUBLIC_URL env
function getPublicUrlOrPath(isEnvDevelopment, homepage, envPublicUrl) {
  if (envPublicUrl) {
    const url = envPublicUrl.endsWith('/') ? envPublicUrl : envPublicUrl + '/'
    return isEnvDevelopment && !url.startsWith('.') ? new URL(url, 'https://x').pathname : url
  }
  if (homepage) {
    const hp = homepage.endsWith('/') ? homepage : homepage + '/'
    const pathname = new URL(hp, 'https://x').pathname
    return isEnvDevelopment && !hp.startsWith('.') ? pathname : hp.startsWith('.') ? hp : pathname
  }
  return '/'
}

const paths = {
  appBuild: resolveApp(process.env.BUILD_PATH || 'build'),
  appPublic: resolveApp('public'),
  appHtml: resolveApp('public/index.html'),
  appIndexJs: resolveApp('src/index.tsx'),
  appSrc: resolveApp('src'),
}

function getClientEnvironment(publicUrl) {
  return {
    'process.env': {
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
      PUBLIC_URL: JSON.stringify(publicUrl),
    },
  }
}

const shouldUseSourceMap = process.env.GENERATE_SOURCEMAP !== 'false'

function getWorkspaces(fromDir) {
  const cwd = fromDir || process.cwd()
  const workspacesStr = cp.execSync('yarn -s workspaces info', { cwd }).toString()
  return Object.values(JSON.parse(workspacesStr)).map(e =>
    path.resolve(path.join('..', '..', e.location)),
  )
}

const cssRegex = /\.css$/
const cssModuleRegex = /\.module\.css$/

module.exports = function webpackBuilder(webpackEnv) {
  const isEnvDevelopment = webpackEnv === 'development'
  const isEnvProduction = webpackEnv === 'production'

  const publicUrlOrPath = getPublicUrlOrPath(
    isEnvDevelopment,
    require(resolveApp('package.json')).homepage,
    process.env.PUBLIC_URL,
  )

  const env = getClientEnvironment(publicUrlOrPath.slice(0, -1))
  const cssSourceMap = isEnvProduction ? shouldUseSourceMap : true

  const getStyleLoaders = cssOptions => [
    isEnvDevelopment && 'style-loader',
    isEnvProduction && {
      loader: MiniCssExtractPlugin.loader,
      options: publicUrlOrPath.startsWith('.') ? { publicPath: '../../' } : {},
    },
    { loader: 'css-loader', options: cssOptions },
  ].filter(Boolean)

  return {
    ...(process.env.NO_CACHE ? { cache: false } : {}),
    target: ['browserslist'],
    stats: 'errors-warnings',
    mode: isEnvProduction ? 'production' : 'development',
    bail: isEnvProduction,
    devtool: isEnvProduction
      ? shouldUseSourceMap ? 'source-map' : false
      : 'cheap-module-source-map',
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
        ? info => path.relative(paths.appSrc, info.absoluteResourcePath).replace(/\\/g, '/')
        : info => path.resolve(info.absoluteResourcePath).replace(/\\/g, '/'),
    },
    resolve: {
      conditionNames: ['mui-modern', '...'],
      modules: ['node_modules'],
      extensions: moduleFileExtensions,
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
            },
            {
              test: cssRegex,
              exclude: cssModuleRegex,
              use: getStyleLoaders({
                importLoaders: 1,
                sourceMap: cssSourceMap,
                modules: { mode: 'icss' },
              }),
              sideEffects: true,
            },
            {
              test: cssModuleRegex,
              use: getStyleLoaders({
                importLoaders: 1,
                sourceMap: cssSourceMap,
                modules: {
                  mode: 'local',
                  localIdentName: '[name]_[local]__[hash:base64:5]',
                },
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
        publicPath: publicUrlOrPath,
        ...(isEnvProduction && {
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
        }),
      }),
      new webpack.DefinePlugin(env),
      isEnvDevelopment && new ReactRefreshWebpackPlugin({ overlay: false }),
      isEnvProduction && new MiniCssExtractPlugin({
        filename: 'static/css/[name].[contenthash:8].css',
        chunkFilename: 'static/css/[name].[contenthash:8].chunk.css',
      }),
      new WebpackManifestPlugin({
        fileName: 'asset-manifest.json',
        publicPath: publicUrlOrPath,
        generate: (seed, files, entrypoints) => ({
          files: files.reduce((manifest, file) => {
            manifest[file.name] = file.path
            return manifest
          }, seed),
          entrypoints: entrypoints.main.filter(f => !f.endsWith('.map')),
        }),
      }),
    ].filter(Boolean),
    performance: false,
    ...(isEnvDevelopment && {
      devServer: {
        port: process.env.PORT || 3000,
        hot: true,
        open: true,
      },
    }),
  }
}

// Export paths for use in build.js
module.exports.paths = paths
