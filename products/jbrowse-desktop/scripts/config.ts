import path from 'path'

import type { Configuration } from 'webpack'

export default function desktopConfig(config: Configuration) {
  config.target = 'electron-renderer'
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
