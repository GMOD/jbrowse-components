const { defineConfig } = require('@rsbuild/core')

module.exports = defineConfig({
  output: {
    assetPrefix: 'auto',
    sourceMap: 'source-map',
  },
  html: {
    title: 'JBrowse',
    favicon: 'public/favicon.ico',
    meta: {
      description: 'A fast and flexible genome browser',
    },
  },
})
