import path from 'path'

import type { Configuration } from 'webpack'
import webpack from 'webpack'

export default function desktopConfig(config: Configuration) {
  config.plugins!.push(
    new webpack.DefinePlugin({
      'process.env.ENABLE_TYPE_CHECK': '"true"',
    }),
  )
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
  config.output!.publicPath = 'auto'
  return config
}
