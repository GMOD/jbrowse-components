/* eslint-disable import/no-extraneous-dependencies */
const webpack = require('webpack')
const {
  baseJBrowsePluginWebpackConfig,
} = require('@gmod/jbrowse-development-tools')

const package = require('./package.json')

module.exports = baseJBrowsePluginWebpackConfig(webpack, __dirname, package)
