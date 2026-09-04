import fs from 'fs'
import path from 'path'

import { JBROWSE_PROTOCOL } from '../../electron/launchTarget.ts'
import {
  APPIMAGETOOL_SHA256,
  APPIMAGETOOL_VERSION,
  appimagetoolUrl,
} from './appimagetool.ts'
import { linuxArtifacts } from './artifacts.ts'
import { APP_NAME, ASSETS, DIST, PRODUCT_NAME, VERSION } from './config.ts'
import { packageApp } from './packager.ts'
import {
  SESSION_MIME_ICON_NAME,
  SESSION_MIME_TYPE,
  sessionMimeXml,
} from './sessionFileType.ts'
import {
  ensureDir,
  fileSizeMB,
  generateLatestYml,
  log,
  run,
  sha256Hex,
} from './utils.ts'

export async function buildLinux({ noInstaller = false } = {}) {
  log('Building Linux package...')

  const { dir: electronAppDir } = await packageApp('linux')

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
MimeType=${SESSION_MIME_TYPE};x-scheme-handler/${JBROWSE_PROTOCOL};
`,
  )

  // Define the type the MimeType line above claims. Saying we handle
  // application/x-jbrowse does not say which files are of that type, and until
  // this existed nothing did — no glob, so no session ever matched and the
  // declaration could not fire however thoroughly the AppImage was integrated.
  const mimeDir = path.join(appDir, 'usr/share/mime/packages')
  ensureDir(mimeDir)
  fs.writeFileSync(
    path.join(mimeDir, `${APP_NAME}.xml`),
    sessionMimeXml(PRODUCT_NAME),
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

  // The same icon again, for the file type rather than the application. A
  // mimetypes-context icon named after the media type with its slash dashed is
  // how freedesktop looks one up, so the name is the whole registration — and
  // the apps-context copy above will not do, because that context is only
  // consulted for applications.
  const mimeIconDir = path.join(
    appDir,
    'usr/share/icons/hicolor/256x256/mimetypes',
  )
  ensureDir(mimeIconDir)
  fs.copyFileSync(
    pngIcon,
    path.join(mimeIconDir, `${SESSION_MIME_ICON_NAME}.png`),
  )

  const appimagetool = path.join(DIST, '.tools', 'appimagetool')
  ensureDir(path.dirname(appimagetool))
  log(`Downloading appimagetool ${APPIMAGETOOL_VERSION}...`)
  run(`curl -fsSL -o "${appimagetool}" "${appimagetoolUrl()}"`)
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
