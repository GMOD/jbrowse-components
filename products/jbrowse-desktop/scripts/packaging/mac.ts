import fs from 'fs'
import path from 'path'

import { macArtifacts } from './artifacts.ts'
import { APP_NAME, DIST, PRODUCT_NAME, VERSION } from './config.ts'
import { packageApp } from './packager.ts'
import { notarizeMac, stapleMac, verifyMacCodesign } from './signing.ts'
import { fileSizeMB, generateLatestYml, log, run } from './utils.ts'

export async function buildMac({ noInstaller = false } = {}) {
  log('Building macOS package...')

  if (process.platform !== 'darwin') {
    throw new Error('macOS builds require running on macOS')
  }

  const { dir: electronAppDir, bundle: appPath } = await packageApp('mac')

  verifyMacCodesign(appPath)

  // For --no-installer mode (e.g., E2E tests), just return the unpacked app dir
  if (noInstaller) {
    log(`Unpacked app at: ${electronAppDir}`)
    return electronAppDir
  }

  // Notarize and staple the app itself, before it is placed into the DMG and
  // ZIP, so both artifacts carry a bundle whose ticket Gatekeeper can verify
  // offline. The DMG then needs no separate notarization — the app it contains
  // is already stapled.
  if (await notarizeMac(appPath)) {
    stapleMac(appPath)
  }

  const {
    dmg: dmgName,
    zip: zipName,
    manifest,
  } = macArtifacts({ appName: APP_NAME, version: VERSION })
  const dmgPath = path.join(DIST, dmgName)
  const zipPath = path.join(DIST, zipName)

  // Create DMG with Applications symlink for drag-to-install
  log('Creating DMG...')
  const applicationsLink = path.join(electronAppDir, 'Applications')
  fs.symlinkSync('/Applications', applicationsLink)
  try {
    run(
      `hdiutil create -volname "${PRODUCT_NAME}" -srcfolder "${electronAppDir}" -ov -format UDZO "${dmgPath}"`,
    )
  } finally {
    try {
      fs.unlinkSync(applicationsLink)
    } catch {}
  }

  // Sign the DMG too. --timestamp obtains a secure Apple timestamp, required
  // for the signature to remain valid (and notarizable) long-term.
  if (process.env.APPLE_ID) {
    run(`codesign --sign "Developer ID Application" --timestamp "${dmgPath}"`)
  }

  // Create ZIP (for auto-update). ditto, not zip: Squirrel.Mac re-validates the
  // code signature after unpacking, and plain `zip` drops the extended
  // attributes / mangles the framework symlinks inside the .app, which breaks
  // that signature and makes mac auto-updates silently fail. --sequesterRsrc
  // --keepParent is the Apple-recommended incantation for archiving a bundle.
  log('Creating ZIP...')
  run(`ditto -c -k --sequesterRsrc --keepParent "${appPath}" "${zipPath}"`)

  // Cleanup
  fs.rmSync(electronAppDir, { recursive: true })

  fs.writeFileSync(path.join(DIST, manifest), generateLatestYml([zipName]))

  log(`Created: ${dmgName} (${fileSizeMB(dmgPath)})`)
  log(`Created: ${zipName} (${fileSizeMB(zipPath)})`)
  log(`Created: ${manifest}`)

  return { dmgPath, zipPath }
}
