import fs from 'fs'
import path from 'path'

import webpack from 'webpack'

import configFactory from '../../../webpack/config/webpack.config.js'
import build from '../../../webpack/scripts/build.js'

const config = configFactory()
config.plugins.push(
  new webpack.DefinePlugin({
    'process.env.ENABLE_TYPE_CHECK': '"true"',
  }),
)
config.target = 'electron-renderer'
config.resolve.aliasFields = []
config.resolve.mainFields = ['module', 'main']
config.resolve.alias = {
  ...config.resolve.alias,
  'generic-filehandle2': path.resolve(
    import.meta.dirname,
    '../../../node_modules/generic-filehandle2/dist/index.js',
  ),
}
config.output.publicPath = 'auto'

build(config).then(() => {
  const testDataPath = path.resolve(import.meta.dirname, '../build/test_data')
  if (fs.existsSync(testDataPath)) {
    fs.rmSync(testDataPath, { recursive: true })
    console.log('Removed test_data from build')
  }
})
