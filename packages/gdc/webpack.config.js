/* eslint-disable import/no-extraneous-dependencies */
const webpack = require('webpack')
const {
  baseJBrowsePluginWebpackConfig,
} = require('@gmod/jbrowse-development-tools')

const package = require('./package.json')

const config = baseJBrowsePluginWebpackConfig(webpack, __dirname, package)
config.output.library = 'JBrowsePluginGDC'
module.exports = config
