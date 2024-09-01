const { defineConfig } = require('@rsbuild/core')

module.exports = defineConfig({
  output: {
    assetPrefix: 'auto',
  },
  html: {
    title: 'JBrowse',
    favicon: 'public/favicon.ico',
    meta: {
      description: 'A fast and flexible genome browser',
    },
  },
})
