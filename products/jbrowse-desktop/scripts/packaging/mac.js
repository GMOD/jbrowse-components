import fs from 'fs'
import path from 'path'

import { APP_NAME, DIST, PRODUCT_NAME, VERSION } from './config.js'
import { packageApp } from './packager.js'
import { notarizeMacApp, signMacApp } from './signing.js'
import { fileSizeMB, generateLatestYml, log, run } from './utils.js'

export async function buildMac({ noInstaller = false } = {}) {
  log('Building macOS package...')

  if (process.platform !== 'darwin') {
    throw new Error('macOS builds require running on macOS')
  }

  const electronAppDir = await packageApp('darwin', 'universal')
  const appName = `${PRODUCT_NAME}.app`
  const appPath = path.join(electronAppDir, appName)

  // For --no-installer mode (e.g., E2E tests), just return the unpacked app dir
  if (noInstaller) {
    log(`Unpacked app at: ${electronAppDir}`)
    return electronAppDir
  }

  await signMacApp(appPath)
  await notarizeMacApp(appPath)

  const dmgName = `${APP_NAME}-v${VERSION}-mac.dmg`
  const zipName = `${APP_NAME}-v${VERSION}-mac.zip`
  const dmgPath = path.join(DIST, dmgName)
  const zipPath = path.join(DIST, zipName)

  // Create DMG
  log('Creating DMG...')
  run(
    `hdiutil create -volname "${PRODUCT_NAME}" -srcfolder "${appPath}" -ov -format UDZO "${dmgPath}"`,
  )

  // Sign the DMG too
  if (process.env.APPLE_ID) {
    run(`codesign --sign "Developer ID Application" "${dmgPath}"`)
  }

  // Create ZIP (for auto-update)
  log('Creating ZIP...')
  run(`cd "${electronAppDir}" && zip -r -y "${zipPath}" "${appName}"`)

  // Cleanup
  fs.rmSync(electronAppDir, { recursive: true })

  // Generate latest-mac.yml
  fs.writeFileSync(
    path.join(DIST, 'latest-mac.yml'),
    generateLatestYml([zipName]),
  )

  log(`Created: ${dmgName} (${fileSizeMB(dmgPath)})`)
  log(`Created: ${zipName} (${fileSizeMB(zipPath)})`)
  log('Created: latest-mac.yml')

  return { dmgPath, zipPath }
}
