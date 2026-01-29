#!/usr/bin/env node

/**
 * Simple Electron packaging script - replaces electron-builder
 *
 * Produces:
 * - Linux: AppImage + latest-linux.yml
 * - macOS: DMG + ZIP + latest-mac.yml (with code signing & notarization)
 * - Windows: NSIS EXE + latest.yml (with code signing)
 *
 * Auto-updates work via electron-updater reading latest*.yml from GitHub releases
 */

import { execSync, spawnSync } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const BUILD = path.join(ROOT, 'build')
const ASSETS = path.join(ROOT, 'assets')

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const VERSION = pkg.version
const APP_NAME = 'jbrowse-desktop'
const PRODUCT_NAME = 'JBrowse 2'
const APP_ID = 'org.jbrowse2.app'

// Signing config
const APPLE_TEAM_ID = '9KR53J86Q2'

function log(msg) {
  console.log(`\n→ ${msg}`)
}

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd.length > 100 ? cmd.slice(0, 100) + '...' : cmd}`)
  return execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts })
}

function runQuiet(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', cwd: ROOT, ...opts }).trim()
}

function sha512Base64(filePath) {
  const hash = crypto.createHash('sha512')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('base64')
}

function fileSize(filePath) {
  return fs.statSync(filePath).size
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

// Generate app-update.yml for electron-updater
function generateAppUpdateYml() {
  return `provider: github
owner: GMOD
repo: jbrowse-components
`
}

// Generate latest*.yml for electron-updater
function generateLatestYml(files) {
  const lines = [`version: ${VERSION}`, `files:`]

  for (const file of files) {
    const filePath = path.join(DIST, file)
    if (fs.existsSync(filePath)) {
      lines.push(`  - url: ${file}`)
      lines.push(`    sha512: ${sha512Base64(filePath)}`)
      lines.push(`    size: ${fileSize(filePath)}`)
    }
  }

  if (files.length > 0 && fs.existsSync(path.join(DIST, files[0]))) {
    lines.push(`path: ${files[0]}`)
    lines.push(`sha512: ${sha512Base64(path.join(DIST, files[0]))}`)
  }

  lines.push(`releaseDate: '${new Date().toISOString()}'`)
  return lines.join('\n')
}

async function packageApp(platform, arch) {
  log(`Packaging for ${platform}-${arch}...`)

  const packager = (await import('@electron/packager')).default

  // Create minimal package.json for packaged app
  const appPkg = {
    name: APP_NAME,
    version: VERSION,
    main: 'electron.js',
    type: 'module',
  }
  fs.writeFileSync(path.join(BUILD, 'package.json'), JSON.stringify(appPkg, null, 2))

  // Also write app-update.yml for electron-updater
  fs.writeFileSync(path.join(BUILD, 'app-update.yml'), generateAppUpdateYml())

  const outDir = path.join(DIST, 'unpacked')
  ensureDir(outDir)

  const icon = platform === 'win32'
    ? path.join(ASSETS, 'icon.ico')
    : platform === 'darwin'
      ? path.join(ASSETS, 'icon.icns')
      : undefined

  const opts = {
    dir: BUILD,
    out: outDir,
    name: PRODUCT_NAME,
    platform,
    arch,
    appVersion: VERSION,
    appBundleId: APP_ID,
    icon,
    overwrite: true,
    asar: true,
    prune: false,
    appCategoryType: 'public.app-category.science',
  }

  // macOS signing during packaging
  if (platform === 'darwin' && process.env.APPLE_ID) {
    opts.osxSign = {
      identity: `Developer ID Application`,
      hardenedRuntime: true,
      entitlements: path.join(ROOT, 'entitlements.plist'),
      'entitlements-inherit': path.join(ROOT, 'entitlements.plist'),
    }
  }

  const appPaths = await packager(opts)

  // Cleanup temp files
  fs.unlinkSync(path.join(BUILD, 'package.json'))
  fs.unlinkSync(path.join(BUILD, 'app-update.yml'))

  return appPaths[0]
}

// ============== macOS Code Signing & Notarization ==============

async function signMacApp(appPath) {
  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD) {
    log('Skipping macOS code signing (APPLE_ID not set)')
    return
  }

  log('Signing macOS app...')

  // Sign with codesign
  const identity = 'Developer ID Application'
  run(`codesign --deep --force --options runtime --sign "${identity}" "${appPath}"`)

  log('macOS app signed')
}

async function notarizeMacApp(appPath) {
  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD) {
    log('Skipping macOS notarization (APPLE_ID not set)')
    return
  }

  if (!process.env.GITHUB_ACTIONS) {
    log('Skipping macOS notarization (not in CI)')
    return
  }

  log('Notarizing macOS app...')

  const { notarize } = await import('@electron/notarize')

  await notarize({
    tool: 'notarytool',
    teamId: APPLE_TEAM_ID,
    appBundleId: APP_ID,
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
  })

  log('macOS app notarized')
}

// ============== Windows Code Signing ==============

function signWindowsFile(filePath) {
  if (!process.env.WINDOWS_SIGN_CREDENTIAL_ID) {
    log(`Skipping Windows code signing for ${path.basename(filePath)}`)
    return
  }

  log(`Signing ${path.basename(filePath)}...`)

  const tempDir = path.join(DIST, '.sign-temp')
  ensureDir(tempDir)

  const tmpExe = path.join(tempDir, `tmp-${Date.now()}.exe`)

  fs.copyFileSync(filePath, tmpExe)

  const signCmd = [
    'CODE_SIGN_TOOL_PATH=code_signer bash code_signer/CodeSignTool.sh sign',
    `-input_file_path='${tmpExe}'`,
    `-output_dir_path='${tempDir}'`,
    `-credential_id='${process.env.WINDOWS_SIGN_CREDENTIAL_ID}'`,
    `-username='${process.env.WINDOWS_SIGN_USER_NAME}'`,
    `-password='${process.env.WINDOWS_SIGN_USER_PASSWORD}'`,
    `-totp_secret='${process.env.WINDOWS_SIGN_USER_TOTP}'`,
  ].join(' ')

  run(signCmd)

  // Copy signed file back
  const signedFile = path.join(tempDir, path.basename(tmpExe))
  fs.copyFileSync(signedFile, filePath)

  // Cleanup
  fs.rmSync(tempDir, { recursive: true, force: true })

  log(`Signed: ${path.basename(filePath)}`)
}

// ============== NSIS Installer ==============

function createNsisScript(appDir, outputExe) {
  const script = `
!include "MUI2.nsh"
!include "FileFunc.nsh"

Name "${PRODUCT_NAME}"
OutFile "${outputExe}"
InstallDir "$PROGRAMFILES64\\${PRODUCT_NAME}"
RequestExecutionLevel admin

!define MUI_ICON "${path.join(ASSETS, 'installerIcon.ico').replace(/\\/g, '\\\\')}"
!define MUI_UNICON "${path.join(ASSETS, 'installerIcon.ico').replace(/\\/g, '\\\\')}"

!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath $INSTDIR

  ; Copy all files from the app directory
  File /r "${appDir.replace(/\\/g, '\\\\')}\\*.*"

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\\Uninstall.exe"

  ; Create Start Menu shortcut
  CreateDirectory "$SMPROGRAMS\\${PRODUCT_NAME}"
  CreateShortcut "$SMPROGRAMS\\${PRODUCT_NAME}\\${PRODUCT_NAME}.lnk" "$INSTDIR\\${PRODUCT_NAME}.exe"
  CreateShortcut "$SMPROGRAMS\\${PRODUCT_NAME}\\Uninstall.lnk" "$INSTDIR\\Uninstall.exe"

  ; Create Desktop shortcut
  CreateShortcut "$DESKTOP\\${PRODUCT_NAME}.lnk" "$INSTDIR\\${PRODUCT_NAME}.exe"

  ; Write registry keys for Add/Remove Programs
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}" "UninstallString" "$INSTDIR\\Uninstall.exe"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}" "DisplayIcon" "$INSTDIR\\${PRODUCT_NAME}.exe"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}" "Publisher" "JBrowse Team"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}" "DisplayVersion" "${VERSION}"

  ; Get installed size
  \${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  ; Remove files
  RMDir /r "$INSTDIR"

  ; Remove Start Menu items
  RMDir /r "$SMPROGRAMS\\${PRODUCT_NAME}"

  ; Remove Desktop shortcut
  Delete "$DESKTOP\\${PRODUCT_NAME}.lnk"

  ; Remove registry keys
  DeleteRegKey HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}"
SectionEnd
`
  return script
}

async function createWindowsInstaller(electronAppDir) {
  const exeName = `${APP_NAME}-v${VERSION}-win.exe`
  const exePath = path.join(DIST, exeName)

  // Check if makensis is available
  let nsisAvailable = false
  try {
    runQuiet('makensis -VERSION')
    nsisAvailable = true
  } catch {
    // Check for Wine + NSIS on Linux
    if (process.platform === 'linux') {
      try {
        runQuiet('wine --version')
        // Assume NSIS might be available via Wine
        nsisAvailable = false // Would need more setup
      } catch {
        nsisAvailable = false
      }
    }
  }

  if (nsisAvailable) {
    log('Creating NSIS installer...')

    const nsisScript = createNsisScript(electronAppDir, exePath)
    const scriptPath = path.join(DIST, 'installer.nsi')
    fs.writeFileSync(scriptPath, nsisScript)

    run(`makensis "${scriptPath}"`)

    fs.unlinkSync(scriptPath)

    // Sign the installer
    signWindowsFile(exePath)

    log(`Created: ${exeName}`)
    return exePath
  }

  // Fallback: create portable ZIP
  log('NSIS not available - creating portable ZIP...')
  const portableZip = path.join(DIST, `${APP_NAME}-v${VERSION}-win-portable.zip`)
  run(`cd "${electronAppDir}" && zip -r "${portableZip}" .`)
  log(`Created: ${path.basename(portableZip)}`)
  return portableZip
}

// ============== Platform Builders ==============

async function buildLinux() {
  log('Building Linux AppImage...')

  const electronAppDir = await packageApp('linux', 'x64')
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
  const execPath = path.join(appDir, PRODUCT_NAME)
  if (fs.existsSync(execPath)) {
    fs.renameSync(execPath, path.join(appDir, `${PRODUCT_NAME}.bin`))
  }

  // Create AppRun with --no-sandbox fix
  const appRun = `#!/bin/bash
HERE="$(dirname "$(readlink -f "\${0}")")"
exec "\${HERE}/${PRODUCT_NAME}.bin" --no-sandbox "$@"
`
  fs.writeFileSync(path.join(appDir, 'AppRun'), appRun)
  fs.chmodSync(path.join(appDir, 'AppRun'), 0o755)

  // Create .desktop file
  const desktop = `[Desktop Entry]
Name=${PRODUCT_NAME}
Exec=AppRun %U
Terminal=false
Type=Application
Icon=${APP_NAME}
Categories=Science;Biology;
MimeType=application/x-jbrowse;
`
  fs.writeFileSync(path.join(appDir, `${APP_NAME}.desktop`), desktop)

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
    run(`curl -fsSL -o "${appimagetool}" "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage"`)
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
  const latestYml = generateLatestYml([appImageName])
  fs.writeFileSync(path.join(DIST, 'latest-linux.yml'), latestYml)

  log(`Created: ${appImageName} (${(fileSize(appImagePath) / 1024 / 1024).toFixed(1)} MB)`)
  log('Created: latest-linux.yml')

  return appImagePath
}

async function buildMac() {
  log('Building macOS DMG and ZIP...')

  if (process.platform !== 'darwin') {
    throw new Error('macOS builds require running on macOS')
  }

  const arch = 'universal'
  const electronAppDir = await packageApp('darwin', arch)
  const appName = `${PRODUCT_NAME}.app`
  const appPath = path.join(electronAppDir, appName)

  // Code sign
  await signMacApp(appPath)

  // Notarize (only in CI)
  await notarizeMacApp(appPath)

  const dmgName = `${APP_NAME}-v${VERSION}-mac.dmg`
  const zipName = `${APP_NAME}-v${VERSION}-mac.zip`
  const dmgPath = path.join(DIST, dmgName)
  const zipPath = path.join(DIST, zipName)

  // Create DMG
  log('Creating DMG...')
  run(`hdiutil create -volname "${PRODUCT_NAME}" -srcfolder "${appPath}" -ov -format UDZO "${dmgPath}"`)

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
  const latestYml = generateLatestYml([zipName])
  fs.writeFileSync(path.join(DIST, 'latest-mac.yml'), latestYml)

  log(`Created: ${dmgName} (${(fileSize(dmgPath) / 1024 / 1024).toFixed(1)} MB)`)
  log(`Created: ${zipName} (${(fileSize(zipPath) / 1024 / 1024).toFixed(1)} MB)`)
  log('Created: latest-mac.yml')

  return { dmgPath, zipPath }
}

async function buildWindows() {
  log('Building Windows package...')

  const electronAppDir = await packageApp('win32', 'x64')

  // Sign the main executable before packaging
  const mainExe = path.join(electronAppDir, `${PRODUCT_NAME}.exe`)
  if (fs.existsSync(mainExe)) {
    signWindowsFile(mainExe)
  }

  // Create installer
  const installerPath = await createWindowsInstaller(electronAppDir)
  const installerName = path.basename(installerPath)

  // Cleanup unpacked dir
  fs.rmSync(electronAppDir, { recursive: true })

  // Generate latest.yml
  if (installerName.endsWith('.exe')) {
    const latestYml = generateLatestYml([installerName])
    fs.writeFileSync(path.join(DIST, 'latest.yml'), latestYml)
    log('Created: latest.yml')
  }

  return installerPath
}

// ============== Main ==============

async function main() {
  const args = process.argv.slice(2)

  let platforms = []
  for (const arg of args) {
    if (arg === '--linux' || arg === 'linux') {
      platforms.push('linux')
    } else if (arg === '--mac' || arg === 'mac' || arg === '--darwin') {
      platforms.push('mac')
    } else if (arg === '--win' || arg === 'win' || arg === '--windows') {
      platforms.push('win')
    } else if (arg === '--all') {
      platforms = ['linux', 'mac', 'win']
    }
  }

  if (platforms.length === 0) {
    const p = process.platform
    platforms = [p === 'darwin' ? 'mac' : p === 'win32' ? 'win' : 'linux']
  }

  console.log(`
╔══════════════════════════════════════════════════════╗
║  JBrowse Desktop Packager v${VERSION.padEnd(27)}║
║  Platforms: ${platforms.join(', ').padEnd(42)}║
║                                                      ║
║  Code Signing:                                       ║
║    macOS: ${process.env.APPLE_ID ? '✓ Enabled' : '✗ Disabled (set APPLE_ID)'.padEnd(43)}║
║    Windows: ${process.env.WINDOWS_SIGN_CREDENTIAL_ID ? '✓ Enabled' : '✗ Disabled (set WINDOWS_SIGN_*)'.padEnd(41)}║
╚══════════════════════════════════════════════════════╝`)

  log('Preparing dist directory...')
  fs.rmSync(DIST, { recursive: true, force: true })
  ensureDir(DIST)

  if (!fs.existsSync(BUILD) || !fs.existsSync(path.join(BUILD, 'electron.js'))) {
    console.error('\n❌ Build directory not found. Run `pnpm build` first.')
    process.exit(1)
  }

  for (const platform of platforms) {
    try {
      if (platform === 'linux') {
        await buildLinux()
      } else if (platform === 'mac') {
        await buildMac()
      } else if (platform === 'win') {
        await buildWindows()
      }
    } catch (err) {
      console.error(`\n❌ Error building for ${platform}:`, err.message)
      if (process.env.DEBUG) {
        console.error(err.stack)
      }
    }
  }

  console.log(`
╔══════════════════════════════════════════════════════╗
║  Build Complete!                                     ║
╚══════════════════════════════════════════════════════╝`)

  const files = fs.readdirSync(DIST).filter(f => {
    const p = path.join(DIST, f)
    return fs.statSync(p).isFile() && !f.startsWith('.')
  })

  console.log('\nArtifacts:')
  for (const file of files.sort()) {
    const size = fileSize(path.join(DIST, file))
    const sizeMb = size > 1024 * 1024
      ? `${(size / 1024 / 1024).toFixed(1)} MB`
      : `${(size / 1024).toFixed(1)} KB`
    console.log(`  ${file.padEnd(50)} ${sizeMb}`)
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
