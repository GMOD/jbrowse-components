import fs from 'fs'
import path from 'path'

import desktopConfig from './config.ts'
import configFactory from '../../../webpack/config/webpack.config.ts'
import build from '../../../webpack/scripts/build.ts'

void build(desktopConfig(configFactory())).then(() => {
  const testDataPath = path.resolve(import.meta.dirname, '../build/test_data')
  if (fs.existsSync(testDataPath)) {
    fs.rmSync(testDataPath, { recursive: true })
    console.log('Removed test_data from build')
  }
})
