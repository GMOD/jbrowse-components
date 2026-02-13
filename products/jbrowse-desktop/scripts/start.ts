import path from 'path'

import webpack from 'webpack'

import configFactory from '../../../webpack/config/webpack.config.ts'
import startServer from '../../../webpack/scripts/start.ts'

process.env.NODE_ENV = 'development'

const config = configFactory()
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

startServer(config)
