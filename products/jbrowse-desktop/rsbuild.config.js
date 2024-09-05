const { defineConfig } = require('@rsbuild/core')

module.exports = defineConfig({
  tools: {
    rspack: {
      target: 'electron-renderer',
    },
  },
  output: {
    sourceMap: {
      js:
        process.env.NODE_ENV === 'production'
          ? // Use a high quality source map format for production
            'source-map'
          : // Use a more performant source map format for development
            'cheap-module-source-map',
    },
  },
  html: {
    title: 'JBrowse',
    meta: {
      description: 'A fast and flexible genome browser',
    },
  },
})
