import fs from 'fs'
import path from 'path'

import { APP_NAME, ASSETS, DIST, PRODUCT_NAME, VERSION } from './config.js'
import { packageApp } from './packager.js'
import { ensureDir, fileSizeMB, generateLatestYml, log, run } from './utils.js'

export async function buildLinux({ noInstaller = false } = {}) {
  log('Building Linux package...')

  const electronAppDir = await packageApp('linux', 'x64')

  // For --no-installer mode (e.g., E2E tests), just return the unpacked app dir
  if (noInstaller) {
    log(`Unpacked app at: ${electronAppDir}`)
    return electronAppDir
  }

  log('Creating AppImage...')
  const appImageName = `${APP_NAME}-v${VERSION}-linux.AppImage`
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
MimeType=application/x-jbrowse;
`,
  )

  // Handle icons
  const iconDir = path.join(appDir, 'usr/share/icons/hicolor/256x256/apps')
  ensureDir(iconDir)

  const pngIcon = path.join(ASSETS, 'icon.png')
  if (fs.existsSync(pngIcon)) {
    fs.copyFileSync(pngIcon, path.join(iconDir, `${APP_NAME}.png`))
    fs.copyFileSync(pngIcon, path.join(appDir, `${APP_NAME}.png`))
    fs.copyFileSync(pngIcon, path.join(appDir, '.DirIcon'))
  } else {
    fs.writeFileSync(path.join(appDir, `${APP_NAME}.png`), '')
    fs.writeFileSync(path.join(appDir, '.DirIcon'), '')
  }

  // Download appimagetool if needed
  const toolDir = path.join(DIST, '.tools')
  ensureDir(toolDir)
  const appimagetool = path.join(toolDir, 'appimagetool')

  if (!fs.existsSync(appimagetool)) {
    log('Downloading appimagetool...')
    run(
      `curl -fsSL -o "${appimagetool}" "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage"`,
    )
    fs.chmodSync(appimagetool, 0o755)
  }

  log('Creating AppImage...')
  run(`"${appimagetool}" --no-appstream "${appDir}" "${appImagePath}"`, {
    env: { ...process.env, ARCH: 'x86_64' },
  })

  // Cleanup
  fs.rmSync(appDir, { recursive: true })
  fs.rmSync(electronAppDir, { recursive: true })

  // Generate latest-linux.yml
  fs.writeFileSync(
    path.join(DIST, 'latest-linux.yml'),
    generateLatestYml([appImageName]),
  )

  log(`Created: ${appImageName} (${fileSizeMB(appImagePath)})`)
  log('Created: latest-linux.yml')

  return appImagePath
}
