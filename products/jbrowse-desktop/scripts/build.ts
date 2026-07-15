import fs from 'fs'
import path from 'path'

import desktopConfig from './config.ts'
import configFactory from '../../../webpack/config/webpack.config.ts'
import build from '../../../webpack/scripts/build.ts'

const pkgPath = path.resolve(import.meta.dirname, '../package.json')
const originalPkgContent = fs.readFileSync(pkgPath, 'utf8')
const pkg = JSON.parse(originalPkgContent)
const customVersion = process.env.JBROWSE_VERSION

if (customVersion) {
  pkg.version = customVersion
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
}

void build(desktopConfig(configFactory()))
  .then(() => {
    if (customVersion) {
      fs.writeFileSync(pkgPath, originalPkgContent)
    }
    const testDataPath = path.resolve(import.meta.dirname, '../build/test_data')
    if (fs.existsSync(testDataPath)) {
      fs.rmSync(testDataPath, { recursive: true })
      console.log('Removed test_data from build')
    }
  })
  .catch((err: unknown) => {
    if (customVersion) {
      fs.writeFileSync(pkgPath, originalPkgContent)
    }
    throw err
  })
