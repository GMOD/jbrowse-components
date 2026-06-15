import path from 'path'

import type { Configuration } from 'webpack'

export default function desktopConfig(config: Configuration) {
  config.target = 'electron-renderer'

  // flatten all JS to the asar root so a file:// './' publicPath resolves the
  // same from index.html (main thread) and from workers; a static/js/ prefix
  // doubles to static/js/static/js/ in workers
  if (process.env.NODE_ENV === 'production') {
    config.output!.publicPath = './'
    config.output!.filename = '[name].[contenthash:8].js'
    config.output!.chunkFilename = '[name].[contenthash:8].chunk.js'
  }

  config.resolve!.aliasFields = []
  config.resolve!.mainFields = ['module', 'main']
  config.resolve!.alias = {
    ...config.resolve!.alias,
    'generic-filehandle2': path.resolve(
      import.meta.dirname,
      '../../../node_modules/generic-filehandle2/dist/index.js',
    ),
  }
  return config
}
