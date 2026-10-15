import fs from 'fs'
import path from 'path'

import configFactory from '../../../config/webpack/config/webpack.config.ts'
import build from '../../../config/webpack/scripts/build.ts'
import desktopConfig from './config.ts'

await build(desktopConfig(configFactory()))

const testDataPath = path.resolve(import.meta.dirname, '../build/test_data')
if (fs.existsSync(testDataPath)) {
  fs.rmSync(testDataPath, { recursive: true })
  console.log('Removed test_data from build')
}
