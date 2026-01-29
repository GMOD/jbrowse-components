import fs from 'fs'
import path from 'path'

import { APP_NAME, ASSETS, DIST, PRODUCT_NAME, VERSION } from './config.js'
import { packageApp } from './packager.js'
import { signWindowsFile } from './signing.js'
import { generateLatestYml, log, run, runQuiet } from './utils.js'

function createNsisScript(appDir, outputExe) {
  const iconPath = path.join(ASSETS, 'installerIcon.ico').replace(/\\/g, '\\\\')
  const appDirEscaped = appDir.replace(/\\/g, '\\\\')

  return `
!include "MUI2.nsh"
!include "FileFunc.nsh"

Name "${PRODUCT_NAME}"
OutFile "${outputExe}"
InstallDir "$PROGRAMFILES64\\${PRODUCT_NAME}"
RequestExecutionLevel admin

!define MUI_ICON "${iconPath}"
!define MUI_UNICON "${iconPath}"

!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath $INSTDIR

  ; Copy all files from the app directory
  File /r "${appDirEscaped}\\*.*"

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
    // NSIS not available
  }

  if (nsisAvailable) {
    log('Creating NSIS installer...')

    const scriptPath = path.join(DIST, 'installer.nsi')
    fs.writeFileSync(scriptPath, createNsisScript(electronAppDir, exePath))

    run(`makensis "${scriptPath}"`)
    fs.unlinkSync(scriptPath)

    signWindowsFile(exePath)

    log(`Created: ${exeName}`)
    return exePath
  }

  // Fallback: create portable ZIP
  log('NSIS not available - creating portable ZIP...')
  const portableZip = path.join(
    DIST,
    `${APP_NAME}-v${VERSION}-win-portable.zip`,
  )
  run(`cd "${electronAppDir}" && zip -r "${portableZip}" .`)
  log(`Created: ${path.basename(portableZip)}`)
  return portableZip
}

export async function buildWindows() {
  log('Building Windows package...')

  const electronAppDir = await packageApp('win32', 'x64')

  // Sign the main executable before packaging
  const mainExe = path.join(electronAppDir, `${PRODUCT_NAME}.exe`)
  if (fs.existsSync(mainExe)) {
    signWindowsFile(mainExe)
  }

  const installerPath = await createWindowsInstaller(electronAppDir)
  const installerName = path.basename(installerPath)

  // Cleanup unpacked dir
  fs.rmSync(electronAppDir, { recursive: true })

  // Generate latest.yml
  if (installerName.endsWith('.exe')) {
    fs.writeFileSync(
      path.join(DIST, 'latest.yml'),
      generateLatestYml([installerName]),
    )
    log('Created: latest.yml')
  }

  return installerPath
}
