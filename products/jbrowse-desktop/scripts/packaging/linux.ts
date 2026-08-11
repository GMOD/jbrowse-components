import fs from 'fs'
import path from 'path'

import { JBROWSE_PROTOCOL } from '../../electron/launchTarget.ts'
import { linuxArtifacts } from './artifacts.ts'
import { APP_NAME, ASSETS, DIST, PRODUCT_NAME, VERSION } from './config.ts'
import { packageApp } from './packager.ts'
import {
  ensureDir,
  fileSizeMB,
  generateLatestYml,
  log,
  run,
  sha256Hex,
} from './utils.ts'

// A tagged release, not the rolling `continuous` tag this used to pull.
// `continuous` is rebuilt in place, so every Linux release was built by whatever
// happened to be behind that URL that day, unverified — a changed upstream build
// either breaks the release or silently alters the artifact, and nothing here
// would notice either. Vendoring it was considered: the binary is 15MB, which is
// 15MB in git forever, per bump, for a file that then never gets a security
// update. A pin plus a checksum buys the same reproducibility and none of that.
//
// To bump: change the version, download the asset, `sha256sum` it, paste. The
// build refuses to run a binary whose hash does not match, so a wrong paste
// fails loudly rather than silently disabling the check.
const APPIMAGETOOL_VERSION = '1.9.1'
const APPIMAGETOOL_SHA256 =
  'ed4ce84f0d9caff66f50bcca6ff6f35aae54ce8135408b3fa33abfc3cb384eb0'
const APPIMAGETOOL_URL = `https://github.com/AppImage/appimagetool/releases/download/${APPIMAGETOOL_VERSION}/appimagetool-x86_64.AppImage`

export async function buildLinux({ noInstaller = false } = {}) {
  log('Building Linux package...')

  const electronAppDir = await packageApp('linux', 'x64')

  // For --no-installer mode (e.g., E2E tests), just return the unpacked app dir
  if (noInstaller) {
    log(`Unpacked app at: ${electronAppDir}`)
    return electronAppDir
  }

  log('Creating AppImage...')
  const { appImage: appImageName, manifest } = linuxArtifacts({
    appName: APP_NAME,
    version: VERSION,
  })
  const appImagePath = path.join(DIST, appImageName)

  // Create AppDir structure
  const appDir = path.join(DIST, `${APP_NAME}.AppDir`)
  ensureDir(appDir)

  if (!fs.existsSync(electronAppDir)) {
    throw new Error(`Packaged app not found at ${electronAppDir}`)
  }
  fs.cpSync(electronAppDir, appDir, { recursive: true })

  // Rename executable for wrapper script
  const execPath = path.join(appDir, APP_NAME)
  if (fs.existsSync(execPath)) {
    fs.renameSync(execPath, path.join(appDir, `${APP_NAME}.bin`))
  }

  // Create AppRun with --no-sandbox fix
  fs.writeFileSync(
    path.join(appDir, 'AppRun'),
    `#!/bin/bash
HERE="$(dirname "$(readlink -f "\${0}")")"
exec "\${HERE}/${APP_NAME}.bin" --no-sandbox "$@"
`,
  )
  fs.chmodSync(path.join(appDir, 'AppRun'), 0o755)

  // Create .desktop file
  fs.writeFileSync(
    path.join(appDir, `${APP_NAME}.desktop`),
    `[Desktop Entry]
Name=${PRODUCT_NAME}
Exec=AppRun %U
Terminal=false
Type=Application
Icon=${APP_NAME}
Categories=Science;Biology;
MimeType=application/x-jbrowse;x-scheme-handler/${JBROWSE_PROTOCOL};
`,
  )

  // Handle icons
  const iconDir = path.join(appDir, 'usr/share/icons/hicolor/256x256/apps')
  ensureDir(iconDir)

  const pngIcon = path.join(ASSETS, 'icon.png')
  if (!fs.existsSync(pngIcon)) {
    throw new Error(`App icon not found: ${pngIcon}`)
  }
  fs.copyFileSync(pngIcon, path.join(iconDir, `${APP_NAME}.png`))
  fs.copyFileSync(pngIcon, path.join(appDir, `${APP_NAME}.png`))
  fs.copyFileSync(pngIcon, path.join(appDir, '.DirIcon'))

  const appimagetool = path.join(DIST, '.tools', 'appimagetool')
  ensureDir(path.dirname(appimagetool))
  log(`Downloading appimagetool ${APPIMAGETOOL_VERSION}...`)
  run(`curl -fsSL -o "${appimagetool}" "${APPIMAGETOOL_URL}"`)
  // Checked, not assumed. This binary is fetched over the network in the middle
  // of a release and then runs on the artifact users download, so "the URL
  // returned 200" is not enough to go on.
  const digest = sha256Hex(appimagetool)
  if (digest !== APPIMAGETOOL_SHA256) {
    throw new Error(
      `appimagetool ${APPIMAGETOOL_VERSION} has sha256 ${digest}, expected ${APPIMAGETOOL_SHA256}. Refusing to build a release with it.`,
    )
  }
  fs.chmodSync(appimagetool, 0o755)

  log('Creating AppImage...')
  run(`"${appimagetool}" --no-appstream "${appDir}" "${appImagePath}"`, {
    env: { ...process.env, ARCH: 'x86_64' },
  })

  // Cleanup
  fs.rmSync(appDir, { recursive: true })
  fs.rmSync(electronAppDir, { recursive: true })

  fs.writeFileSync(path.join(DIST, manifest), generateLatestYml([appImageName]))

  log(`Created: ${appImageName} (${fileSizeMB(appImagePath)})`)
  log(`Created: ${manifest}`)

  return appImagePath
}
