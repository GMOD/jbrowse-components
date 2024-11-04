const { defineConfig } = require('@rsbuild/core')
import { pluginReact } from '@rsbuild/plugin-react'
module.exports = defineConfig({
  plugins: [pluginReact()],
  output: {
    assetPrefix: 'auto',
    sourceMap: {
      js: 'source-map',
    },
  },
  html: {
    title: 'JBrowse',
    favicon: 'public/favicon.ico',
    meta: {
      description: 'A fast and flexible genome browser',
    },
  },
})
