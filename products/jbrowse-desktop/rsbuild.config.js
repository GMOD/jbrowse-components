const { defineConfig } = require('@rsbuild/core')

module.exports = defineConfig({
  tools: {
    rspack: {
      target: 'electron-renderer',
    },
  },
  html: {
    title: 'JBrowse',
    meta: {
      description: 'A fast and flexible genome browser',
    },
  },
})
